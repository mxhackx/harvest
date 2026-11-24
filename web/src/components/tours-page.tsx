"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, describeError, type Lead } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { formatDuration, formatKm, googleMapsUrl, moveStop, toGpx, toggleStop, type Tour, type TourPlan, type TourPoint, type TourStop } from "@/lib/tours";
import { TrashIcon } from "./icons";
import { TourMap } from "./tour-map";
import { Button, Field, Notice } from "./ui";

type Tab = "create" | "mine";
type Located = Lead & { lat: number; lng: number };
const today = () => new Date().toISOString().slice(0, 10);
const isCandidate = (l: Lead): l is Located => l.visitMode === "onsite" && l.lat !== null && l.lng !== null;

/** Tournées : on choisit des prospects à visiter, on calcule l'itinéraire entre eux, on enregistre ou on exporte. */
export function ToursPage() {
  const { companyId } = useSession();
  const { leads } = useLeads();
  const [tab, setTab] = useState<Tab>("create");
  const [error, setError] = useState<string | null>(null);

  // le formulaire de création
  const [name, setName] = useState("");
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState("08:00");
  const [stopMinutes, setStopMinutes] = useState("20");
  const [start, setStart] = useState<TourPoint | null>(null);
  const [comeBack, setComeBack] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [pickStart, setPickStart] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // les prospects proposés
  const [query, setQuery] = useState("");
  const [onlyToVisit, setOnlyToVisit] = useState(true);

  const [tours, setTours] = useState<Tour[] | null>(null);
  const loadTours = useCallback(() => api<Tour[]>("/tours", { companyId }).then(setTours).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    loadTours();
  }, [loadTours]);

  const candidates = useMemo(() => (leads ?? []).filter(isCandidate), [leads]);
  const byId = useMemo(() => new Map(candidates.map((l) => [l.id, l])), [candidates]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((l) => (!onlyToVisit || !l.visitedAt) && (!q || `${l.name} ${l.city} ${l.sector}`.toLowerCase().includes(q)));
  }, [candidates, query, onlyToVisit]);

  const end: TourPoint | null = comeBack && start ? start : null;
  // la sélection change : l'itinéraire calculé n'est plus valable
  const edit = (fn: () => void) => {
    fn();
    setPlan(null);
    setSaved(false);
  };

  const body = () => ({ start: start!, end, leadIds: selected, startTime, stopMinutes: Math.max(0, Math.floor(Number(stopMinutes) || 0)) });
  const compute = async (optimize: boolean) => {
    if (!start) return setError("Choisissez d’abord le point de départ (votre position, ou un clic sur la carte).");
    if (selected.length === 0) return setError("Cochez au moins un prospect à visiter.");
    setBusy(optimize ? "optimize" : "plan");
    try {
      const result = await api<TourPlan>("/tours/plan", { companyId, body: { ...body(), optimize } });
      setPlan(result);
      setSelected(result.stops.map((s) => s.leadId)); // l'ordre calculé devient l'ordre affiché
      setError(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (!start) return;
    setBusy("save");
    try {
      await api("/tours", { companyId, body: { ...body(), optimize: false, name: name.trim() || `Tournée du ${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR")}`, plannedOn: date } });
      setSaved(true);
      setError(null);
      await loadTours();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) return setError("Votre navigateur ne sait pas donner votre position : cliquez sur la carte.");
    navigator.geolocation.getCurrentPosition(
      (p) => edit(() => setStart({ lat: p.coords.latitude, lng: p.coords.longitude, label: "Ma position" })),
      () => setError("Position refusée ou indisponible : cliquez sur la carte pour placer le départ."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  const open = (t: Tour) => {
    setName(t.name);
    setDate(t.plannedOn);
    setStartTime(t.startTime);
    setStopMinutes(String(t.stopMinutes));
    setStart(t.start);
    setComeBack(!!t.end);
    setSelected(t.stops.map((s) => s.leadId));
    setPlan({ stops: t.stops, legs: t.legs, totalKm: t.totalKm, drivingMin: t.totalMin, totalMin: t.totalMin, arrivals: t.arrivals, endsAt: t.endsAt, geometry: t.geometry, approximate: t.approximate });
    setSaved(true);
    setTab("create");
  };
  const mark = async (t: Tour, status: Tour["status"]) => {
    await api(`/tours/${t.id}`, { method: "PATCH", companyId, body: { status } }).catch((e) => setError(describeError(e)));
    await loadTours();
  };
  const remove = async (t: Tour) => {
    if (!window.confirm(`Supprimer la tournée « ${t.name} » ?`)) return;
    await api(`/tours/${t.id}`, { method: "DELETE", companyId }).catch((e) => setError(describeError(e)));
    await loadTours();
  };

  // les étapes affichées : celles du plan calculé, sinon la sélection dans l'ordre choisi
  const stops: TourStop[] = plan ? plan.stops : selected.flatMap((id) => (byId.get(id) ? [{ leadId: id, name: byId.get(id)!.name, city: byId.get(id)!.city, phone: byId.get(id)!.phone, lat: byId.get(id)!.lat, lng: byId.get(id)!.lng }] : []));
  const gm = start && stops.length ? googleMapsUrl(start, stops, end) : null;
  const download = () => {
    if (!start || !plan) return;
    const url = URL.createObjectURL(new Blob([toGpx(name || "Tournée", start, plan.stops, plan.geometry)], { type: "application/gpx+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tournee-${date}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-title font-semibold">Tournées</h1>
        <p className="text-small text-muted">Choisissez les prospects à visiter en présentiel, calculez l’itinéraire entre eux, puis enregistrez ou ouvrez-le dans votre GPS.</p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div role="tablist" aria-label="Tournées" className="flex gap-1 border-b border-rule">
        {([["create", "Créer"], ["mine", `Mes tournées${tours ? ` (${tours.length})` : ""}`]] as const).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)} className={`h-9 border-b-2 px-3 text-body font-medium ${tab === key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        tours === null ? (
          <p className="text-small text-muted">Chargement…</p>
        ) : tours.length === 0 ? (
          <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucune tournée enregistrée. Créez-en une dans l’onglet « Créer ».</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {tours.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-small text-muted">
                      {new Date(`${t.plannedOn}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · {t.stops.length} étape{t.stops.length > 1 ? "s" : ""} · {formatKm(t.totalKm)} · {formatDuration(t.totalMin)}
                    </p>
                  </div>
                  <span className={`inline-flex h-[22px] items-center rounded-md border px-2 text-small font-medium ${t.status === "done" ? "border-forest text-forest" : "border-border"}`}>{t.status === "done" ? "Faite" : "Prévue"}</span>
                  <button type="button" aria-label={`Supprimer ${t.name}`} onClick={() => remove(t)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                    <TrashIcon size={15} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-9 w-auto" onClick={() => open(t)}>
                    Ouvrir
                  </Button>
                  <Button variant="secondary" className="h-9 w-auto" onClick={() => mark(t, t.status === "done" ? "planned" : "done")}>
                    {t.status === "done" ? "Remettre en prévue" : "Marquer comme faite"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 rounded-card border border-border bg-card p-3">
              <Field label="Nom de la tournée" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={100} placeholder="Mardi · Cotonou centre" className="col-span-2" />
              <Field label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSaved(false); }} />
              <Field label="Départ à" type="time" value={startTime} onChange={(e) => edit(() => setStartTime(e.target.value))} />
              <Field label="Minutes par étape" inputMode="numeric" value={stopMinutes} onChange={(e) => edit(() => setStopMinutes(e.target.value))} className="font-mono" />
            </div>

            <section aria-label="Point de départ" className="rounded-card border border-border bg-card p-3">
              <p className="mb-2 text-small font-semibold">Point de départ</p>
              <p className="mb-2 text-small text-muted">{start ? `✓ ${start.label || `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}`}` : "Pas encore choisi"}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="h-9 w-auto" onClick={locate}>
                  Ma position
                </Button>
                <Button variant={pickStart ? "primary" : "secondary"} className="h-9 w-auto" aria-pressed={pickStart} onClick={() => setPickStart((v) => !v)}>
                  {pickStart ? "Cliquez sur la carte…" : "Placer sur la carte"}
                </Button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-small">
                <input type="checkbox" className="size-4 accent-accent" checked={comeBack} onChange={(e) => edit(() => setComeBack(e.target.checked))} />
                Revenir au point de départ
              </label>
            </section>

            <section aria-label="Étapes" className="rounded-card border border-border bg-card p-3">
              <p className="mb-2 text-small font-semibold">Étapes ({selected.length}/30)</p>
              {selected.length > 0 && (
                <ol className="mb-3 flex flex-col gap-1">
                  {stops.map((s, i) => (
                    <li key={s.leadId} className="flex items-center gap-2 rounded-control bg-field px-2 py-1.5 text-small">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                      {plan?.arrivals[i] && <span className="font-mono text-muted">{plan.arrivals[i]}</span>}
                      <button type="button" aria-label={`Monter ${s.name}`} disabled={i === 0} onClick={() => edit(() => setSelected(moveStop(stops.map((x) => x.leadId), i, -1)))} className="px-1 text-muted hover:text-ink disabled:opacity-30">↑</button>
                      <button type="button" aria-label={`Descendre ${s.name}`} disabled={i === stops.length - 1} onClick={() => edit(() => setSelected(moveStop(stops.map((x) => x.leadId), i, 1)))} className="px-1 text-muted hover:text-ink disabled:opacity-30">↓</button>
                      <button type="button" aria-label={`Retirer ${s.name}`} onClick={() => edit(() => setSelected((c) => c.filter((x) => x !== s.leadId)))} className="px-1 text-muted hover:text-fail">×</button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mb-2 flex items-center gap-2">
                <input type="search" aria-label="Chercher un prospect" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un prospect…" className="h-9 min-w-0 flex-1 rounded-control border border-border bg-field px-3 text-small" />
              </div>
              <label className="mb-2 flex items-center gap-2 text-small">
                <input type="checkbox" className="size-4 accent-accent" checked={onlyToVisit} onChange={(e) => setOnlyToVisit(e.target.checked)} />
                Seulement les prospects pas encore visités
              </label>
              <ul aria-label="Prospects à visiter" className="flex max-h-[260px] flex-col overflow-y-auto">
                {shown.length === 0 ? (
                  <li className="py-2 text-small text-muted">Aucun prospect en présentiel avec une position{onlyToVisit ? " à visiter" : ""}.</li>
                ) : (
                  shown.map((l) => (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-small hover:bg-field">
                        <input type="checkbox" className="size-4 accent-accent" checked={selected.includes(l.id)} onChange={() => edit(() => setSelected((c) => toggleStop(c, l.id)))} />
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        <span className="shrink-0 text-muted">{l.city}</span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative h-[460px] overflow-hidden rounded-card border border-border bg-field lg:h-[560px]">
              <TourMap start={start} end={end} stops={stops} geometry={plan?.geometry ?? []} pickStart={pickStart} onPickStart={(lat, lng) => edit(() => { setStart({ lat, lng, label: "Point choisi sur la carte" }); setPickStart(false); })} />
              <ul aria-label="Légende" className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-control border border-border bg-card/90 px-3 py-2 text-small backdrop-blur">
                <li className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full bg-forest" />Départ (D)</li>
                <li className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full bg-accent" />Étapes (1, 2…)</li>
                <li className="flex items-center gap-2"><span aria-hidden className="h-0.5 w-3 bg-accent" />Itinéraire</li>
              </ul>
            </div>

            <dl aria-label="Résumé" className="grid grid-cols-3 gap-3">
              {[
                ["Durée", plan ? formatDuration(plan.totalMin) : "—"],
                ["Fin prévue", plan ? plan.endsAt : "—"],
                ["Distance", plan ? formatKm(plan.totalKm) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-card border border-border bg-card p-3">
                  <dt className="text-small text-muted">{label}</dt>
                  <dd className="font-mono text-title font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {plan?.approximate && <p className="text-small text-muted">Itinéraire estimé en ligne droite (le service d’itinéraires ne répond pas) : les durées et distances sont approximatives.</p>}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="h-9 w-auto" loading={busy === "plan"} onClick={() => compute(false)}>
                Calculer l’itinéraire
              </Button>
              <Button className="h-9 w-auto" loading={busy === "optimize"} onClick={() => compute(true)}>
                Optimiser l’ordre
              </Button>
              <Button className="h-9 w-auto" variant="secondary" disabled={!plan || saved} loading={busy === "save"} onClick={save}>
                {saved ? "Enregistrée" : "Enregistrer"}
              </Button>
              {gm && (
                <a href={gm.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-control border border-frame bg-card px-3 text-body font-medium hover:bg-field">
                  Ouvrir dans Google Maps
                </a>
              )}
              <Button variant="secondary" className="h-9 w-auto" disabled={!plan} onClick={download}>
                Télécharger (GPX)
              </Button>
            </div>
            {gm?.truncated && <p className="text-small text-muted">Google Maps accepte 9 étapes intermédiaires au plus : le lien garde les 9 premières. Utilisez le GPX pour la tournée complète.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
