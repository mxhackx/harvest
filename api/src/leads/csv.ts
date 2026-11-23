export class CsvError extends Error {}

export type Delimiter = "," | ";" | "\t";
export type CsvRecord = { fields: string[]; line: number };

/** Devine le séparateur d'après l'en-tête : celui qui apparaît le plus, hors guillemets. */
export function detectDelimiter(text: string): Delimiter {
  const header = text.replace(/^﻿/, "").split(/\r\n|\n|\r/, 1)[0] ?? "";
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of header) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch as Delimiter]++;
  }
  const best = (Object.keys(counts) as Delimiter[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[best] > 0 ? best : ",";
}

/**
 * Lecteur CSV conforme à la RFC 4180 : champs entre guillemets, guillemets doublés, sauts de ligne
 * dans un champ, fins de ligne CRLF / LF / CR, BOM UTF-8. Les lignes entièrement vides sont ignorées.
 * `line` est la ligne physique où commence l'enregistrement (pour des messages d'erreur exacts).
 */
export function parseCsv(input: string, delimiter: Delimiter = detectDelimiter(input)): CsvRecord[] {
  const text = input.replace(/^﻿/, "");
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  let touched = false; // l'enregistrement en cours contient-il quelque chose ?

  const endField = () => {
    fields.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    if (fields.some((f) => f.trim() !== "")) records.push({ fields, line: startLine });
    fields = [];
    touched = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (!touched) startLine = line;
    if (ch === '"' && field === "") {
      quoted = true;
      touched = true;
    } else if (ch === delimiter) {
      endField();
      touched = true;
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
    } else {
      field += ch;
      touched = true;
    }
  }
  if (quoted) throw new CsvError(`guillemet non refermé (le champ commence ligne ${startLine})`);
  if (touched || field !== "" || fields.length) endRecord();
  return records;
}
