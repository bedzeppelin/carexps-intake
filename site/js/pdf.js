// A small PDF writer, enough for the intake form and nothing more.
//
// This mirrors the layout of `desk-service/src/pdf.js`, which uses PDFKit on
// the clinic PC. The browser cannot run PDFKit without shipping a megabyte of
// library, and the project's rule is that nothing loads from a third-party
// host at runtime — so the review site writes the PDF itself.
//
// It only needs to do four things: place text, draw rules and filled boxes,
// and embed one signature image. Helvetica is one of the fourteen fonts every
// PDF reader is required to have built in, so no font data is embedded.

const MARGIN = 50;
const PAGE_W = 612;   // US Letter at 72dpi
const PAGE_H = 792;

const NAVY  = [0.094, 0.169, 0.361];   // #182B5C
const BLUE  = [0.216, 0.341, 0.847];   // #3757D8
const MUTED = [0.408, 0.404, 0.420];   // #68676B
const RULE  = [0.847, 0.835, 0.812];   // #D8D5CF
const INK   = [0.200, 0.204, 0.227];   // #33343A
const BAND  = [0.965, 0.961, 0.945];   // #F6F5F1

// Helvetica and Helvetica-Bold advance widths, in 1/1000 em, for ASCII 32-126.
// Anything outside that range falls back to WIDTH_DEFAULT.
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const WIDTH_DEFAULT = 556;

// Characters outside Latin-1 that the document actually uses, mapped to their
// WinAnsi byte. Anything still unmapped becomes '?' rather than corrupting the
// stream.
const WINANSI = {
  '—': 0x97, '–': 0x96, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85
};

const clamp01 = n => Math.max(0, Math.min(1, n));
const fmt = n => (Math.round(n * 100) / 100).toString();

function charWidth(code, bold) {
  if (code >= 32 && code <= 126) return (bold ? W_BOLD : W_REG)[code - 32];
  if (code === 0x97) return 1000;          // em dash
  if (code === 0x96) return 556;           // en dash
  if (code === 0xB7) return 278;           // middle dot
  return WIDTH_DEFAULT;
}

function toBytes(text) {
  const out = [];
  for (const ch of String(text)) {
    const mapped = WINANSI[ch];
    if (mapped != null) { out.push(mapped); continue; }
    const cp = ch.codePointAt(0);
    out.push(cp <= 0xFF ? cp : 0x3F);
  }
  return out;
}

export function textWidth(text, size, bold) {
  let total = 0;
  for (const code of toBytes(text)) total += charWidth(code, bold);
  return total * size / 1000;
}

// Greedy wrap on spaces; a single word longer than the column is broken.
function wrapText(text, size, bold, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (textWidth(candidate, size, bold) <= width || !line) {
        if (textWidth(candidate, size, bold) > width && !line) {
          let chunk = '';
          for (const ch of word) {
            if (textWidth(chunk + ch, size, bold) > width && chunk) { lines.push(chunk); chunk = ch; }
            else chunk += ch;
          }
          line = chunk;
        } else line = candidate;
      } else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

// Escapes the three characters that are special inside a PDF literal string.
function pdfString(text) {
  let out = '';
  for (const code of toBytes(text)) {
    const ch = String.fromCharCode(code);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code < 32 || code > 126) out += '\\' + code.toString(8).padStart(3, '0');
    else out += ch;
  }
  return out;
}

class Page {
  constructor() { this.ops = []; }
  // PDF's origin is bottom-left; every y below is passed top-down and flipped
  // here, so the layout code reads the same way the PDFKit version does.
  text(str, x, yTop, { size = 9.5, bold = false, color = INK, oblique = false } = {}) {
    const font = bold ? '/F2' : oblique ? '/F3' : '/F1';
    this.ops.push('BT', `${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])} rg`,
      `${font} ${fmt(size)} Tf`, `1 0 0 1 ${fmt(x)} ${fmt(PAGE_H - yTop - size)} Tm`,
      `(${pdfString(str)}) Tj`, 'ET');
  }
  rect(x, yTop, w, h, color) {
    this.ops.push('q', `${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])} rg`,
      `${fmt(x)} ${fmt(PAGE_H - yTop - h)} ${fmt(w)} ${fmt(h)} re f`, 'Q');
  }
  line(x1, yTop, x2, color, width = 0.75) {
    const y = PAGE_H - yTop;
    this.ops.push('q', `${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])} RG`,
      `${fmt(width)} w`, `${fmt(x1)} ${fmt(y)} m ${fmt(x2)} ${fmt(y)} l S`, 'Q');
  }
  strokeRect(x, yTop, w, h, color, width = 0.75) {
    this.ops.push('q', `${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])} RG`,
      `${fmt(width)} w`, `${fmt(x)} ${fmt(PAGE_H - yTop - h)} ${fmt(w)} ${fmt(h)} re S`, 'Q');
  }
  image(name, x, yTop, w, h) {
    this.ops.push('q', `${fmt(w)} 0 0 ${fmt(h)} ${fmt(x)} ${fmt(PAGE_H - yTop - h)} cm`, `/${name} Do`, 'Q');
  }
  toStream() { return this.ops.join('\n'); }
}

// Converts the signature PNG to JPEG via a canvas. PDF carries JPEG bytes
// verbatim under DCTDecode, so this avoids implementing an image compressor.
function signatureToJpeg(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const jpeg = canvas.toDataURL('image/jpeg', 0.92);
        const raw = atob(jpeg.split(',')[1]);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        resolve({ bytes, width: canvas.width, height: canvas.height });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function serialize(pages, signature) {
  const objects = [];
  const add = body => { objects.push(body); return objects.length; };   // 1-based

  const fontReg = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const fontObl = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');

  let imageObj = 0;
  if (signature) {
    imageObj = add({
      dict: `<< /Type /XObject /Subtype /Image /Width ${signature.width} /Height ${signature.height} `
          + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${signature.bytes.length} >>`,
      binary: signature.bytes
    });
  }

  const xobject = imageObj ? `/XObject << /Sig ${imageObj} 0 R >>` : '';
  const resources = `<< /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R /F3 ${fontObl} 0 R >> ${xobject} >>`;

  const pagesObjNumber = objects.length + pages.length * 2 + 1;
  const pageRefs = [];
  for (const page of pages) {
    const stream = page.toStream();
    const contentObj = add({ dict: `<< /Length ${new TextEncoder().encode(stream).length} >>`, text: stream });
    pageRefs.push(add(
      `<< /Type /Page /Parent ${pagesObjNumber} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] `
      + `/Resources ${resources} /Contents ${contentObj} 0 R >>`));
  }

  const pagesObj = add(`<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.map(r => r + ' 0 R').join(' ')}] >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  // Assemble. Offsets are byte counts, so everything is built as bytes.
  const chunks = [];
  let length = 0;
  const push = data => {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(length);
    push(`${i + 1} 0 obj\n`);
    if (typeof body === 'string') push(body + '\n');
    else {
      push(body.dict + '\nstream\n');
      push(body.binary || body.text);
      push('\nendstream\n');
    }
    push('endobj\n');
  });

  const xrefAt = length;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) push(String(offset).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

const DASH = '—';
const or = v => (v != null && String(v).trim() !== '' ? String(v) : DASH);

const patientName = sub => sub.patient
  ? [sub.patient.first, sub.patient.last].filter(Boolean).join(' ') || 'Patient'
  : ((sub.consent && sub.consent.printedName) || 'Patient');

/**
 * Renders one submission as a PDF, laid out like the paper intake form.
 * `sections` is the output of the app's own receiptSections(), so the printed
 * document and the on-screen summary can never disagree.
 */
export async function renderIntakePdf(sub, { sections, clinicName }) {
  const signature = sub.consent && sub.consent.signaturePng
    ? await signatureToJpeg(sub.consent.signaturePng)
    : null;

  const contentW = PAGE_W - MARGIN * 2;
  const pages = [];
  let page = new Page();
  let y = MARGIN;
  pages.push(page);

  const newPage = () => { page = new Page(); pages.push(page); y = MARGIN; };
  const ensure = needed => { if (y + needed > PAGE_H - MARGIN - 24) newPage(); };
  const rule = (gap = 8) => { page.line(MARGIN, y + gap, PAGE_W - MARGIN, RULE); y += gap + 10; };

  // Header
  page.text(clinicName.toUpperCase(), PAGE_W - MARGIN - textWidth(clinicName.toUpperCase(), 9, true), y,
    { size: 9, bold: true, color: MUTED });
  y += 22;
  page.text('Patient Intake Form', MARGIN, y, { size: 20, bold: true, color: NAVY });
  y += 26;
  page.text(`Submitted ${new Date(sub.meta.submittedAt).toLocaleString('en-CA')}   ${DASH}   Ref ${sub.meta.id.slice(0, 8)}`,
    MARGIN, y, { size: 9, color: MUTED });
  y += 12;
  rule(10);

  // Identity band — what a staffer needs to match this to a chart, without
  // reading any further.
  const p = sub.patient || {};
  const band = [
    ['Name', patientName(sub)],
    ['Date of birth', or(p.dob)],
    ['Health number', or(sub.checkin && sub.checkin.ohip)],
    ['Phone', or(p.cellPhone || p.homePhone)]
  ];
  const bandTop = y + 4;
  page.rect(MARGIN, bandTop, contentW, 46, BAND);
  band.forEach(([label, value], i) => {
    const x = MARGIN + 10 + (i % 2) * (contentW / 2);
    const ly = bandTop + 8 + Math.floor(i / 2) * 16;
    page.text(label.toUpperCase(), x, ly, { size: 7.5, bold: true, color: MUTED });
    page.text(value, x + 74, ly - 1, { size: 10, bold: true, color: NAVY });
  });
  y = bandTop + 46 + 12;

  // Sections
  const labelW = 150;
  const valueW = contentW - labelW - 10;
  for (const section of sections) {
    const rows = section.rows.filter(r => !(r.label === 'None given' && r.value === DASH));
    if (!rows.length) continue;
    ensure(60);
    page.text(section.title.toUpperCase(), MARGIN, y, { size: 9, bold: true, color: BLUE });
    y += 14;

    for (const row of rows) {
      const labelLines = wrapText(row.label, 9.5, false, labelW);
      const valueLines = wrapText(String(row.value), 9.5, true, valueW);
      const height = Math.max(labelLines.length, valueLines.length) * 12;
      ensure(height + 6);
      labelLines.forEach((line, i) => page.text(line, MARGIN, y + i * 12, { size: 9.5, color: MUTED }));
      valueLines.forEach((line, i) =>
        page.text(line, MARGIN + labelW + 10, y + i * 12, { size: 9.5, bold: true, color: INK }));
      y += height + 4;
    }
    rule(6);
  }

  // Signature
  if (sub.consent) {
    ensure(150);
    page.text('SIGNATURE', MARGIN, y, { size: 9, bold: true, color: BLUE });
    y += 14;
    const boxW = 300, boxH = 80, boxTop = y;
    page.strokeRect(MARGIN, boxTop, boxW, boxH, RULE);
    if (signature) {
      const scale = Math.min((boxW - 12) / signature.width, (boxH - 12) / signature.height);
      page.image('Sig', MARGIN + 6, boxTop + 6, signature.width * scale, signature.height * scale);
    } else {
      page.text('No signature captured', MARGIN + 10, boxTop + boxH / 2 - 5,
        { size: 9, color: MUTED, oblique: true });
    }
    const x = MARGIN + boxW + 20;
    page.text('PRINTED NAME', x, boxTop + 6, { size: 7.5, bold: true, color: MUTED });
    page.text(or(sub.consent.printedName), x, boxTop + 18, { size: 10, bold: true, color: NAVY });
    page.text('DATE', x, boxTop + 40, { size: 7.5, bold: true, color: MUTED });
    page.text(new Date(sub.meta.submittedAt).toLocaleDateString('en-CA'), x, boxTop + 52,
      { size: 10, bold: true, color: NAVY });
    y = boxTop + boxH + 14;
    page.text(`Consent to treat: ${sub.consent.agreed ? 'given' : 'NOT GIVEN'}`, MARGIN, y,
      { size: 8, color: MUTED });
    y += 14;
  }

  // Footer on every page, once the page count is known.
  pages.forEach((pg, i) => {
    const note = `Patient-entered intake ${DASH} verify before relying on it clinically.    `
      + `Ref ${sub.meta.id.slice(0, 8)}    Page ${i + 1} of ${pages.length}`;
    pg.text(note, (PAGE_W - textWidth(note, 7.5, false)) / 2, PAGE_H - MARGIN + 6,
      { size: 7.5, color: MUTED });
  });

  return serialize(pages, signature);
}
