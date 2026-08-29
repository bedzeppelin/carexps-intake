import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

// Palette lifted from the design system so the filed document and the tablet
// look like the same clinic.
const NAVY = '#182B5C';
const BLUE = '#3757D8';
const MUTED = '#68676B';
const RULE = '#D8D5CF';
const INK = '#33343A';

const MARGIN = 50;
const LOGO = path.join(ROOT, 'assets', 'carexps-logo.png');

// PDFKit's built-in Helvetica is used rather than the web fonts: Figtree and
// DM Sans ship only as variable fonts, which embed as a single weight and
// would leave the document without a usable bold.
const REG = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const OBL = 'Helvetica-Oblique';

const DASH = '\u2014';
const or = v => (v != null && String(v).trim() !== '' ? String(v) : DASH);
const yn = v => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'na' ? 'N/A' : DASH;

export function renderIntakePdf(sub, { receiptSections, clinicName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER', margin: MARGIN,
      info: {
        Title: `Patient Intake ${DASH} ${patientName(sub)}`,
        Author: clinicName,
        Subject: 'Patient intake form',
        CreationDate: new Date(sub.meta.submittedAt)
      }
    });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      header(doc, sub, clinicName);
      identityBlock(doc, sub);
      for (const section of receiptSections) sectionBlock(doc, section);
      signatureBlock(doc, sub);
      footer(doc, sub);
      doc.end();
    } catch (err) { reject(err); }
  });
}

const patientName = sub => sub.patient
  ? [sub.patient.first, sub.patient.last].filter(Boolean).join(' ') || 'Patient'
  : (sub.consent?.printedName || 'Patient');

function header(doc, sub, clinicName) {
  if (fs.existsSync(LOGO)) {
    try { doc.image(LOGO, MARGIN, MARGIN - 8, { height: 24 }); } catch { /* keep going without it */ }
  }
  doc.font(BOLD).fontSize(9).fillColor(MUTED)
     .text(clinicName.toUpperCase(), MARGIN, MARGIN - 4, { align: 'right' });
  doc.moveDown(1.6);
  doc.font(BOLD).fontSize(20).fillColor(NAVY).text('Patient Intake Form', MARGIN, doc.y);
  doc.font(REG).fontSize(9).fillColor(MUTED)
     .text(`Submitted ${new Date(sub.meta.submittedAt).toLocaleString('en-CA')}   ·   Ref ${sub.meta.id.slice(0, 8)}`);
  rule(doc, 10);
}

// Identifiers get their own band at the top: this is what a staffer needs to
// match the document to a chart, and it should never require reading further.
function identityBlock(doc, sub) {
  const p = sub.patient || {};
  const pairs = [
    ['Name', patientName(sub)],
    ['Date of birth', or(p.dob)],
    ['Health number', or(sub.checkin?.ohip)],
    ['Phone', or(p.cellPhone || p.homePhone)]
  ];
  const top = doc.y + 4;
  const colW = (doc.page.width - MARGIN * 2) / 2;
  doc.rect(MARGIN, top, doc.page.width - MARGIN * 2, 46).fill('#F6F5F1');
  pairs.forEach(([label, value], i) => {
    const x = MARGIN + 10 + (i % 2) * colW;
    const y = top + 8 + Math.floor(i / 2) * 16;
    doc.font(BOLD).fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x, y, { width: colW - 20 });
    doc.font(BOLD).fontSize(10).fillColor(NAVY).text(value, x + 74, y - 1, { width: colW - 94, ellipsis: true });
  });
  doc.y = top + 46 + 12;
}

function rule(doc, gap = 8) {
  doc.moveTo(MARGIN, doc.y + gap).lineTo(doc.page.width - MARGIN, doc.y + gap)
     .lineWidth(0.75).strokeColor(RULE).stroke();
  doc.y = doc.y + gap + 10;
}

function sectionBlock(doc, section) {
  const rows = section.rows.filter(r => r.value !== DASH || r.label !== 'None given');
  if (!rows.length) return;
  ensureSpace(doc, 60);

  doc.font(BOLD).fontSize(9).fillColor(BLUE)
     .text(section.title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.6 });
  doc.moveDown(0.35);

  const labelW = 150;
  const valueW = doc.page.width - MARGIN * 2 - labelW - 10;
  for (const row of rows) {
    const h = Math.max(
      doc.font(REG).fontSize(9.5).heightOfString(row.label, { width: labelW }),
      doc.font(REG).fontSize(9.5).heightOfString(String(row.value), { width: valueW })
    );
    ensureSpace(doc, h + 6);
    const y = doc.y;
    doc.font(REG).fontSize(9.5).fillColor(MUTED).text(row.label, MARGIN, y, { width: labelW });
    doc.font(BOLD).fontSize(9.5).fillColor(INK)
       .text(String(row.value), MARGIN + labelW + 10, y, { width: valueW });
    doc.y = y + h + 4;
  }
  rule(doc, 6);
}

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - MARGIN - 24;
  if (doc.y + needed > bottom) doc.addPage();
}

function signatureBlock(doc, sub) {
  if (!sub.consent) return;
  ensureSpace(doc, 150);
  doc.font(BOLD).fontSize(9).fillColor(BLUE).text('SIGNATURE', MARGIN, doc.y, { characterSpacing: 0.6 });
  doc.moveDown(0.4);

  const png = sub.consent.signaturePng;
  const boxTop = doc.y;
  const boxW = 300, boxH = 80;
  doc.rect(MARGIN, boxTop, boxW, boxH).lineWidth(0.75).strokeColor(RULE).stroke();
  if (png && png.startsWith('data:image/png;base64,')) {
    try {
      const buf = Buffer.from(png.split(',')[1], 'base64');
      doc.image(buf, MARGIN + 6, boxTop + 6, { fit: [boxW - 12, boxH - 12], align: 'center', valign: 'center' });
    } catch { /* fall through to the empty box */ }
  } else {
    doc.font(OBL).fontSize(9).fillColor(MUTED)
       .text('No signature captured', MARGIN + 10, boxTop + boxH / 2 - 5);
  }

  const x = MARGIN + boxW + 20;
  doc.font(BOLD).fontSize(7.5).fillColor(MUTED).text('PRINTED NAME', x, boxTop + 6);
  doc.font(BOLD).fontSize(10).fillColor(NAVY).text(or(sub.consent.printedName), x, boxTop + 18);
  doc.font(BOLD).fontSize(7.5).fillColor(MUTED).text('DATE', x, boxTop + 40);
  doc.font(BOLD).fontSize(10).fillColor(NAVY)
     .text(new Date(sub.meta.submittedAt).toLocaleDateString('en-CA'), x, boxTop + 52);
  doc.y = boxTop + boxH + 14;

  doc.font(REG).fontSize(8).fillColor(MUTED)
     .text(`Consent to treat: ${sub.consent.agreed ? 'given' : 'NOT GIVEN'}`, MARGIN, doc.y);
  doc.y += 6;
}

function footer(doc, sub) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - MARGIN + 6;
    doc.font(REG).fontSize(7.5).fillColor(MUTED)
       .text(
         `Patient-entered intake ${DASH} verify before relying on it clinically.    Ref ${sub.meta.id.slice(0, 8)}    Page ${i - range.start + 1} of ${range.count}`,
         MARGIN, y, { width: doc.page.width - MARGIN * 2, align: 'center', lineBreak: false }
       );
  }
}
