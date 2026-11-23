import { leadLinks, type Lead } from "@/lib/api";

/** Liens vers WhatsApp, Facebook, le site et Google Maps — uniquement ceux qui sont renseignés. */
export function LeadLinks({ lead, className = "" }: { lead: Pick<Lead, "whatsapp" | "facebook" | "website" | "googleMapsUrl">; className?: string }) {
  const links = leadLinks(lead);
  if (links.length === 0) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-small ${className}`}>
      {links.map((l, i) => (
        <span key={l.key} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-muted">
              ·
            </span>
          )}
          <a
            href={l.href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-link underline decoration-dotted decoration-2 underline-offset-4"
          >
            {l.label}
          </a>
        </span>
      ))}
    </p>
  );
}
