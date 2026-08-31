// Plain-text clinical note, laid out for pasting into an EMR encounter.
//
// This is the interim bridge until Alembico's API is confirmed: instead of
// re-typing forty fields, staff paste one block. When the API lands, this
// same text becomes the encounter body.

import { painLabel } from '../state.js';

const yn = v => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'na' ? 'N/A' : 'Not stated';
const or = (v, fallback = 'Not stated') => (v && String(v).trim()) ? String(v).trim() : fallback;
const list = (arr, fallback = 'None reported') => arr && arr.length ? arr.join(', ') : fallback;

export function toClinicalNote(sub) {
  const lines = [];
  const push = (label, value) => lines.push(`${label}: ${value}`);
  const section = title => { lines.push('', title.toUpperCase()); };

  const name = sub.patient
    ? [sub.patient.first, sub.patient.last].filter(Boolean).join(' ')
    : or(sub.consent?.printedName, 'Returning patient');

  lines.push(`PATIENT INTAKE — ${new Date(sub.meta.submittedAt).toLocaleString('en-CA')}`);
  push('Patient', or(name));
  if (sub.patient) {
    push('DOB', or(sub.patient.dob));
    // The quick pathway carries name and date of birth only, so skip the rows
    // it never collects rather than printing "Not stated" against each.
    if (sub.patient.sex !== undefined) push('Sex', or(sub.patient.sex));
    if (sub.patient.cellPhone !== undefined || sub.patient.homePhone !== undefined) {
      push('Phone', or(sub.patient.cellPhone || sub.patient.homePhone));
    }
  }
  push('Health number', or(sub.checkin?.ohip, 'Not provided'));
  push('Arrival', sub.checkin?.appointment === 'yes'
    ? `Booked appointment${sub.checkin.appointmentTime ? ' at ' + sub.checkin.appointmentTime : ''}`
    : sub.checkin?.appointment === 'no' ? 'Walk-in' : 'Not stated');

  section('Chief complaint');
  lines.push(or(sub.visit?.problem));

  section('History of present illness');
  push('Onset', or(sub.visit?.onset));
  push('Pain', `${sub.visit?.pain}/10 (${painLabel(sub.visit?.pain ?? 0)})`);
  if (sub.visit?.frequency) push('Frequency', sub.visit.frequency);
  if (sub.visit?.trend) push('Trend', sub.visit.trend);
  if (sub.visit?.workInjury != null) push('Work-related injury', yn(sub.visit.workInjury));
  if (sub.visit?.mva != null) push('Motor vehicle accident', yn(sub.visit.mva));
  if (sub.visit?.symptoms) {
    const symptoms = [...sub.visit.symptoms];
    if (sub.visit.symptomOther) symptoms.push(`${sub.visit.symptomOther} (patient-reported)`);
    push('Associated symptoms', list(symptoms));
  }

  if (sub.allergies) {
    section('Allergies');
    if (sub.allergies.noKnownDrugAllergies) lines.push('No known drug allergies.');
    else push('Drug allergies', list(sub.allergies.drugs));
    for (const a of sub.allergies.other || []) {
      lines.push(`- ${a.allergen}: ${or(a.reaction, 'reaction not stated')}`);
    }
  }

  if (sub.medicalHistory) {
    section('Past medical history');
    push('Conditions', list(sub.medicalHistory.conditions));
    if (sub.medicalHistory.hepatitisTypes?.length) {
      push('Hepatitis type', sub.medicalHistory.hepatitisTypes.join(', '));
    }
    if (sub.medicalHistory.cancerType) push('Cancer type', sub.medicalHistory.cancerType);
  }

  if (sub.surgeries) {
    section('Past surgical history');
    const items = [...sub.surgeries.items];
    if (sub.surgeries.other) items.push(sub.surgeries.other);
    lines.push(list(items, 'None reported'));
  }

  if (sub.medications) {
    section('Medications');
    const rx = sub.medications.prescription || [];
    const otc = sub.medications.nonPrescription || [];
    if (!rx.length && !otc.length) lines.push('None reported.');
    for (const m of rx) lines.push(`- ${[m.name, m.dose, m.frequency].filter(Boolean).join(' ')}`);
    for (const m of otc) lines.push(`- ${[m.name, m.dose, m.frequency].filter(Boolean).join(' ')} (OTC)`);
  }

  if (sub.familyHistory) {
    section('Family history');
    const items = [...sub.familyHistory.conditions];
    if (sub.familyHistory.other) items.push(sub.familyHistory.other);
    lines.push(list(items));
    push('Pregnant', yn(sub.familyHistory.pregnant));
    if (sub.familyHistory.pregnant === 'yes' && sub.familyHistory.weeks) {
      push('Gestational age', `${sub.familyHistory.weeks} weeks`);
    }
  }

  if (sub.familyDoctorRequested) {
    section('Administrative');
    push('Requesting family doctor enrolment', yn(sub.familyDoctorRequested));
  }

  if (sub.consent) {
    section('Consent');
    push('Consent to treat', sub.consent.agreed ? 'Given' : 'NOT GIVEN');
    push('Signed by', or(sub.consent.printedName));
    push('Signature captured', sub.consent.signed ? 'Yes' : 'No');
  }

  lines.push('', 'Patient-entered intake. Verify before relying on it clinically.');
  return lines.join('\n');
}
