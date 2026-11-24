"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { API_URL } from "@/lib/api";
import { QUEUE_EVENT, REACH_EVENT, flushQueue, pendingCount, registerServiceWorker, type QueueEventDetail } from "@/lib/offline";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Mode hors-ligne : enregistre le service worker, rejoue les gestes en attente au retour du réseau, et dit où on en est. */
export function OfflineSupport() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [waiting, setWaiting] = useState(0);
  const waitingRef = useRef(0);
  // vrai quand la dernière lecture est venue de la copie gardée : on est hors connexion même si le navigateur ne le sait pas
  const [stale, setStale] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    registerServiceWorker(API_URL);
    const refresh = () =>
      pendingCount()
        .then((n) => {
          waitingRef.current = n;
          setWaiting(n);
        })
        .catch(() => {});
    const goOnline = () => flushQueue(API_URL).finally(refresh);
    const onQueue = (e: Event) => {
      const d = (e as CustomEvent<QueueEventDetail>).detail;
      if (d.type === "flushed") {
        const { done, dropped } = d.result;
        if (done + dropped > 0) setNote(`${done} action${done > 1 ? "s" : ""} synchronisée${done > 1 ? "s" : ""}${dropped ? `, ${dropped} refusée${dropped > 1 ? "s" : ""} par le serveur` : ""}.`);
      }
      refresh();
    };
    refresh();
    if (navigator.onLine) flushQueue(API_URL).finally(refresh); // des gestes ont pu rester d'une session précédente
    const onReach = (e: Event) => {
      const { stale: isStale } = (e as CustomEvent<{ stale: boolean }>).detail;
      setStale(isStale);
      // le réseau est revenu sans que le navigateur le dise : une lecture réussie suffit pour envoyer ce qui attend
      if (!isStale && waitingRef.current > 0) flushQueue(API_URL).finally(refresh);
    };
    // tant que des gestes attendent, on réessaie toutes les 5 s (l'événement « online » peut manquer ou arriver trop tôt)
    const retry = setInterval(() => {
      if (waitingRef.current > 0) flushQueue(API_URL).finally(refresh);
    }, 5000);
    window.addEventListener(REACH_EVENT, onReach);
    window.addEventListener("online", goOnline);
    window.addEventListener(QUEUE_EVENT, onQueue);
    return () => {
      clearInterval(retry);
      window.removeEventListener(REACH_EVENT, onReach);
      window.removeEventListener("online", goOnline);
      window.removeEventListener(QUEUE_EVENT, onQueue);
    };
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 6000);
    return () => clearTimeout(t);
  }, [note]);

  const offline = !online || stale;
  if (!offline && waiting === 0 && !note) return null;
  return (
    <div role="status" aria-live="polite" className={`mb-4 rounded-control border px-4 py-2 text-small ${offline ? "border-frame bg-field" : "border-banner-edge bg-banner"}`}>
      {offline && (
        <p>
          <strong>Hors connexion.</strong> Vos dernières données restent lisibles ; « visité », l’étape et les notes sont gardés et partiront au retour du réseau.
        </p>
      )}
      {waiting > 0 && (
        <p>
          {waiting} action{waiting > 1 ? "s" : ""} en attente d’envoi{offline ? "." : "…"}
        </p>
      )}
      {!offline && note && <p>{note}</p>}
    </div>
  );
}
