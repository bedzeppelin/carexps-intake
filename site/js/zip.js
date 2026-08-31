// Store-only ZIP writer, so a day's paperwork downloads as one file.
//
// No compression: PDFs and the JPEG signatures inside them are already
// compressed, and CSV/JSON in a day's batch is a few hundred kilobytes at
// most. Leaving out deflate keeps this to one short file with no dependency.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// MS-DOS packed date and time, which is what the ZIP format stores.
function dosStamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2));
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

class Writer {
  constructor() { this.parts = []; this.length = 0; }
  bytes(data) { this.parts.push(data); this.length += data.length; }
  u16(n) { this.bytes(new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF])); }
  u32(n) { this.bytes(new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF])); }
  finish() {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const part of this.parts) { out.set(part, at); at += part.length; }
    return out;
  }
}

const encoder = new TextEncoder();
const asBytes = data => (typeof data === 'string' ? encoder.encode(data) : data);

/**
 * @param {Array<{name: string, data: string|Uint8Array}>} files
 * @returns {Blob} a ZIP archive
 */
export function makeZip(files, { date = new Date() } = {}) {
  const { time, day } = dosStamp(date);
  const out = new Writer();
  const entries = [];

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = asBytes(file.data);
    const crc = crc32(data);
    entries.push({ name, crc, size: data.length, offset: out.length });

    out.u32(0x04034B50);        // local file header
    out.u16(20);                // version needed
    out.u16(0x0800);            // flags: UTF-8 filename
    out.u16(0);                 // method: stored
    out.u16(time); out.u16(day);
    out.u32(crc); out.u32(data.length); out.u32(data.length);
    out.u16(name.length); out.u16(0);
    out.bytes(name);
    out.bytes(data);
  }

  const centralAt = out.length;
  for (const entry of entries) {
    out.u32(0x02014B50);        // central directory header
    out.u16(20); out.u16(20);
    out.u16(0x0800); out.u16(0);
    out.u16(time); out.u16(day);
    out.u32(entry.crc); out.u32(entry.size); out.u32(entry.size);
    out.u16(entry.name.length); out.u16(0); out.u16(0);
    out.u16(0); out.u16(0); out.u32(0);
    out.u32(entry.offset);
    out.bytes(entry.name);
  }
  const centralSize = out.length - centralAt;

  out.u32(0x06054B50);          // end of central directory
  out.u16(0); out.u16(0);
  out.u16(entries.length); out.u16(entries.length);
  out.u32(centralSize); out.u32(centralAt);
  out.u16(0);

  return new Blob([out.finish()], { type: 'application/zip' });
}
