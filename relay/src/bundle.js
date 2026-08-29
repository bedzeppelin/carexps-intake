// Turns a submission into the set of files the clinic receives.
// The exporters are the tablet app's, so a form that arrives by email carries
// exactly the same data, in the same shapes, as one filed by the desk service.

import { toCsv } from '../../app/js/exporters/csv.js';
import { toFhirBundle } from '../../app/js/exporters/fhir.js';
import { toClinicalNote } from '../../app/js/exporters/note.js';

const pad = n => String(n).padStart(2, '0');

export function baseName(sub) {
  const d = new Date(sub.meta.submittedAt);
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const last = (sub.patient?.last || sub.consent?.printedName || 'Patient').trim().split(/\s+/).pop();
  const first = (sub.patient?.first || '').trim().split(/\s+/)[0] || '';
  const safe = s => s.normalize('NFKD').replace(/[^A-Za-z0-9]/g, '');
  const name = [safe(last), safe(first)].filter(Boolean).join('_') || 'Patient';
  return `Intake_${name}_${stamp}_${sub.meta.id.slice(0, 8)}`;
}

export function buildFiles(sub) {
  const stem = baseName(sub);
  return [
    { name: `${stem}.json`, contentType: 'application/json', content: JSON.stringify(sub, null, 2) },
    { name: `${stem}.csv`, contentType: 'text/csv', content: toCsv(sub) },
    { name: `${stem}.fhir.json`, contentType: 'application/fhir+json', content: JSON.stringify(toFhirBundle(sub), null, 2) },
    { name: `${stem}.txt`, contentType: 'text/plain', content: toClinicalNote(sub) }
  ];
}

export function buildMessage(sub) {
  const name = sub.patient
    ? [sub.patient.first, sub.patient.last].filter(Boolean).join(' ')
    : (sub.consent?.printedName || 'a patient');

  return {
    subject: `Intake form — ${name} — ${new Date(sub.meta.submittedAt).toLocaleDateString('en-CA')}`,
    body: [
      'A patient completed the intake form from the website.',
      '',
      `Name:      ${name}`,
      `DOB:       ${sub.patient?.dob || 'not given'}`,
      `Health #:  ${sub.checkin?.ohip || 'not given'}`,
      `Reason:    ${sub.visit?.problem || 'not given'}`,
      `Reference: ${sub.meta.id}`,
      '',
      'Attached:',
      '  .txt        encounter note, ready to paste into the chart',
      '  .csv        one row, for a spreadsheet or bulk import',
      '  .json       full submission',
      '  .fhir.json  FHIR R4 bundle',
      '',
      'This was entered by the patient and has not been verified.'
    ].join('\n')
  };
}
