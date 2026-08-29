// Flat CSV — one row per submission, stable column order.
//
// Columns are declared explicitly rather than derived from the data so the
// header never shifts between a quick check-in and a full registration.
// Anything a given pathway did not collect comes through as an empty cell,
// which is what a spreadsheet or bulk-loader expects.

const JOIN = '; ';

const COLUMNS = [
  ['submission_id',        s => s.meta.id],
  ['submitted_at',         s => s.meta.submittedAt],
  ['pathway',              s => s.meta.pathway],
  ['checkin_method',       s => s.checkin?.method],
  ['ohip',                 s => s.checkin?.ohip],
  ['first_name',           s => s.patient?.first],
  ['last_name',            s => s.patient?.last],
  ['dob',                  s => s.patient?.dob],
  ['sex',                  s => s.patient?.sex],
  ['marital_status',       s => s.patient?.marital],
  ['address',              s => s.patient?.address],
  ['city',                 s => s.patient?.city],
  ['province',             s => s.patient?.province],
  ['postal_code',          s => s.patient?.postal],
  ['home_phone',           s => s.patient?.homePhone],
  ['cell_phone',           s => s.patient?.cellPhone],
  ['email',                s => s.patient?.email],
  ['emergency_1_name',     s => s.emergencyContacts?.[0]?.name],
  ['emergency_1_phone',    s => s.emergencyContacts?.[0]?.phone],
  ['emergency_2_name',     s => s.emergencyContacts?.[1]?.name],
  ['emergency_2_phone',    s => s.emergencyContacts?.[1]?.phone],
  ['reason_for_visit',     s => s.visit?.problem],
  ['onset',                s => s.visit?.onset],
  ['pain_0_10',            s => s.visit?.pain],
  ['work_related_injury',  s => s.visit?.workInjury],
  ['motor_vehicle_accident', s => s.visit?.mva],
  ['symptoms',             s => s.visit?.symptoms?.join(JOIN)],
  ['symptom_other',        s => s.visit?.symptomOther],
  ['symptom_frequency',    s => s.visit?.frequency],
  ['symptom_trend',        s => s.visit?.trend],
  ['no_known_drug_allergies', s => s.allergies && (s.allergies.noKnownDrugAllergies ? 'yes' : 'no')],
  ['drug_allergies',       s => s.allergies?.drugs?.join(JOIN)],
  ['other_allergies',      s => s.allergies?.other?.map(a => `${a.allergen} (${a.reaction || 'reaction not stated'})`).join(JOIN)],
  ['family_doctor_requested', s => s.familyDoctorRequested],
  ['medical_history',      s => s.medicalHistory?.conditions?.join(JOIN)],
  ['hepatitis_types',      s => s.medicalHistory?.hepatitisTypes?.join(JOIN)],
  ['cancer_type',          s => s.medicalHistory?.cancerType],
  ['past_surgeries',       s => s.surgeries?.items?.join(JOIN)],
  ['past_surgeries_other', s => s.surgeries?.other],
  ['prescription_meds',    s => s.medications?.prescription?.map(medText).join(JOIN)],
  ['non_prescription_meds', s => s.medications?.nonPrescription?.map(medText).join(JOIN)],
  ['family_history',       s => s.familyHistory?.conditions?.join(JOIN)],
  ['family_history_other', s => s.familyHistory?.other],
  ['pregnant',             s => s.familyHistory?.pregnant],
  ['pregnancy_weeks',      s => s.familyHistory?.weeks],
  ['consent_agreed',       s => s.consent && (s.consent.agreed ? 'yes' : 'no')],
  ['consent_printed_name', s => s.consent?.printedName],
  ['consent_signed',       s => s.consent && (s.consent.signed ? 'yes' : 'no')]
];

const medText = m => [m.name, m.dose, m.frequency].filter(Boolean).join(' ');

// Excel treats a leading =, +, - or @ as a formula. Prefixing with an
// apostrophe keeps a field like "-2 days ago" from being evaluated.
function escapeCell(value) {
  if (value == null || value === false) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export const csvHeader = () => COLUMNS.map(c => c[0]).join(',');

export const csvRow = sub => COLUMNS.map(([, get]) => escapeCell(get(sub))).join(',');

// A BOM so Excel on Windows opens UTF-8 accented names correctly.
export function toCsv(sub, { withBom = true } = {}) {
  return (withBom ? '\uFEFF' : '') + csvHeader() + '\r\n' + csvRow(sub) + '\r\n';
}
