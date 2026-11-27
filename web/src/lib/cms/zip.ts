/** Archive ZIP sans compression, suffisante pour un projet exporté : aucune dépendance à ajouter. */
const TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files: Record<string, string | Uint8Array>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const record = (size: number, fill: (v: DataView) => void) => {
    const bytes = new Uint8Array(size);
    fill(new DataView(bytes.buffer));
    return bytes;
  };
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path);
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(data);
    const common = (v: DataView, at: number) => {
      v.setUint16(at, 20, true);
      v.setUint16(at + 2, 0x0800, true); // noms en UTF-8
      v.setUint16(at + 8, 0x21, true); // date neutre (1980-01-01)
      v.setUint32(at + 10, crc, true);
      v.setUint32(at + 14, data.length, true);
      v.setUint32(at + 18, data.length, true);
      v.setUint16(at + 22, name.length, true);
    };
    const local = record(30, (v) => { v.setUint32(0, 0x04034b50, true); common(v, 4); });
    central.push(record(46, (v) => { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); common(v, 6); v.setUint32(42, offset, true); }), name);
    parts.push(local, name, data);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0);
  const count = Object.keys(files).length;
  const end = record(22, (v) => { v.setUint32(0, 0x06054b50, true); v.setUint16(8, count, true); v.setUint16(10, count, true); v.setUint32(12, size, true); v.setUint32(16, offset, true); });
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let at = 0;
  for (const c of all) { out.set(c, at); at += c.length; }
  return out;
}
