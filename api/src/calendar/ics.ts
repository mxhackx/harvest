/** Un rendez-vous sans fin connue dure une heure dans le calendrier exporté. */
export const DEFAULT_MINUTES = 60;

export type IcsEvent = { id: string; title: string; startsAt: Date; endsAt: Date | null; notes: string; leadName: string | null };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Échappement RFC 5545 : \, ; , et retours à la ligne. */
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Les lignes de plus de 75 octets sont coupées, la suite commence par une espace. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** Calendrier iCalendar (.ics) lisible par Google Agenda, Apple Calendrier et Outlook. */
export function toIcs(events: IcsEvent[], calendarName: string, now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hivation//Calendrier//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${text(calendarName)}`];
  for (const e of events) {
    const end = e.endsAt && e.endsAt > e.startsAt ? e.endsAt : new Date(e.startsAt.getTime() + DEFAULT_MINUTES * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@hivation`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${text(e.title)}`,
      ...(e.notes || e.leadName ? [`DESCRIPTION:${text([e.leadName ? `Lead : ${e.leadName}` : "", e.notes].filter(Boolean).join("\n"))}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
