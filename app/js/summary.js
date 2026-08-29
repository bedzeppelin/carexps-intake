// Staff-facing summary: the printed receipt, the machine exports, and the
// copy-ready encounter note.

import { el } from './dom.js';
import { receiptSections } from './exporters/receipt.js';
import { toCsv } from './exporters/csv.js';
import { toFhirBundle } from './exporters/fhir.js';
import { toClinicalNote } from './exporters/note.js';

const pad = n => String(n).padStart(2, '0');

// Sortable, unambiguous, and collision-free even for two same-named patients
// checking in within the same minute.
export function exportFilename(sub, ext) {
  const d = new Date(sub.meta.submittedAt);
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const last = (sub.patient?.last || sub.consent?.printedName || 'Patient').split(/\s+/).pop();
  const first = sub.patient?.first || '';
  const name = [last, first].filter(Boolean).join('_').replace(/[^A-Za-z0-9_-]/g, '') || 'Patient';
  return `Intake_${name}_${stamp}_${sub.meta.id.slice(0, 8)}.${ext}`;
}

export function buildReceipt(sub) {
  const sections = receiptSections(sub).map(sec =>
    el('div', { class: 'receipt__section' }, [
      el('div', { class: 'receipt__heading', text: sec.title }),
      ...sec.rows.map(r => el('div', { class: 'receipt__row' }, [
        el('span', { class: 'receipt__label', text: r.label }),
        el('span', { class: 'receipt__value', text: r.value })
      ]))
    ]));

  return el('div', { class: 'receipt' }, [
    el('div', { class: 'receipt__title', text: 'PATIENT INTAKE — STAFF SUMMARY' }),
    el('div', {
      class: 'receipt__date',
      text: new Date(sub.meta.submittedAt).toLocaleString('en-CA')
    }),
    ...sections
  ]);
}

function download(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking promptly matters here: the blob holds patient data in memory.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back for plain-http testing.
    const ta = el('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Wraps a button so it reports back in place instead of firing a dialog.
function actionButton(label, run) {
  const btn = el('button', { type: 'button', class: 'btn-pill btn-pill--md', text: label });
  btn.addEventListener('click', async () => {
    const ok = await run();
    const original = label;
    btn.textContent = ok === false ? 'Copy failed' : 'Done \u2713';
    setTimeout(() => { btn.textContent = original; }, 1600);
  });
  return btn;
}

export function buildExportBar(sub) {
  const note = toClinicalNote(sub);
  const json = JSON.stringify(sub, null, 2);
  const fhir = JSON.stringify(toFhirBundle(sub), null, 2);

  return {
    note,
    bar: el('div', { class: 'export-bar' }, [
      actionButton('Copy encounter note', () => copy(note)),
      actionButton('Copy JSON', () => copy(json)),
      actionButton('Download CSV', () => download(exportFilename(sub, 'csv'), 'text/csv;charset=utf-8', toCsv(sub))),
      actionButton('Download JSON', () => download(exportFilename(sub, 'json'), 'application/json', json)),
      actionButton('Download FHIR', () => download(exportFilename(sub, 'fhir.json'), 'application/fhir+json', fhir)),
      actionButton('Print', () => { window.print(); return true; })
    ])
  };
}
