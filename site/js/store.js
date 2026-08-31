// What the console reads.
//
// Two sources, one list: submissions the patient form wrote to browser storage
// during this demo, and two seeded examples so the console is not empty on a
// first visit. Seeded examples are marked and can be hidden.
//
// On the real system this is the clinic PC's spool directory plus the OneDrive
// folder. Browser storage stands in for it so the review site needs no server.

export const DEMO_KEY = 'carexps.demo.submissions';

const CLINIC = 'CareXPS Urgent Care';
const ADDRESS = '1030 Gordon St, Suite 102, Guelph, ON';

// Synthetic. Invented people, invented health numbers.
export const SEEDED = [
  {
    meta: {
      id: 'a7f3c891-4d02-4b16-9e58-2c7d10ab55f9', formVersion: '1.1',
      clinic: CLINIC, clinicAddress: ADDRESS, pathway: 'full',
      startedAt: '2026-08-31T14:31:08.412Z', submittedAt: '2026-08-31T14:42:19.907Z'
    },
    checkin: {
      method: 'manual', ohip: '4821567390AB',
      appointment: 'no', appointmentTime: ''
    },
    visit: {
      problem: 'Severe right-sided abdominal pain since yesterday evening',
      onset: 'Yesterday around 8pm', pain: 8, workInjury: 'no', mva: 'no',
      symptoms: ['Fever', 'Nausea', 'Vomiting', 'Abdominal pain'],
      symptomOther: '', frequency: 'Constant', trend: 'Worsening'
    },
    patient: {
      first: 'Sarah', last: 'Mitchell', address: '122 Silvercreek Pkwy N', city: 'Guelph',
      province: 'ON', postal: 'N1H 7T9', homePhone: '519-822-4417', cellPhone: '519-546-2208',
      email: 'sarah.mitchell@example.ca', dob: '1987-03-14', sex: 'Female', marital: 'Married'
    },
    emergencyContacts: [
      { name: 'James Mitchell', phone: '519-546-9931' },
      { name: 'Nora Ellis', phone: '226-780-4412' }
    ],
    allergies: {
      noKnownDrugAllergies: false, drugs: ['Penicillin'],
      other: [{ allergen: 'Shellfish', reaction: 'Hives and facial swelling' }]
    },
    familyDoctorRequested: 'yes',
    medicalHistory: {
      conditions: ['Hypertension', 'GERD / acid reflux', 'Migraine'],
      hepatitisTypes: [], cancerType: ''
    },
    surgeries: { items: ['C-section', 'Wisdom teeth extraction'], other: '' },
    medications: {
      prescription: [
        { name: 'Ramipril', dose: '5 mg', frequency: 'Once daily' },
        { name: 'Pantoprazole', dose: '40 mg', frequency: 'Once daily' }
      ],
      nonPrescription: [{ name: 'Vitamin D', dose: '1000 IU', frequency: 'Once daily' }]
    },
    familyHistory: {
      conditions: ['Heart disease', 'High blood pressure', 'Diabetes'],
      other: '', pregnant: 'no', weeks: ''
    },
    consent: {
      agreed: true, printedName: 'Sarah Mitchell', signed: true,
      signedAt: '2026-08-31T14:42:11.220Z'
    }
  },
  {
    meta: {
      id: 'd5b8c2a4-30f7-4e93-b1c6-9a7f45d0e812', formVersion: '1.1',
      clinic: CLINIC, clinicAddress: ADDRESS, pathway: 'quick',
      startedAt: '2026-08-31T12:47:02.330Z', submittedAt: '2026-08-31T12:50:31.744Z'
    },
    checkin: {
      method: 'none', ohip: '',
      appointment: 'yes', appointmentTime: '13:15'
    },
    // No card on them, so name and date of birth are what identify this one.
    patient: { first: 'David', last: 'Okonkwo', dob: '1979-05-22' },
    visit: { problem: 'Sore throat and fever for three days', pain: 4 }
  }
];

// Seeded examples are constants, so deleting one cannot remove it from the
// array — the ids of deleted ones are remembered here instead and filtered out.
const HIDDEN_KEY = 'carexps.demo.hidden';

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

export const readSubmitted = () => readList(DEMO_KEY);

/** Removes one form. Works for both submitted and seeded rows. */
export function removeSubmission(id) {
  const kept = readSubmitted().filter(s => s.meta.id !== id);
  writeList(DEMO_KEY, kept);
  if (SEEDED.some(s => s.meta.id === id)) {
    const hidden = readList(HIDDEN_KEY);
    if (!hidden.includes(id)) writeList(HIDDEN_KEY, [...hidden, id]);
  }
}

export function removeMany(ids) {
  for (const id of ids) removeSubmission(id);
}

/** Back to a first-visit state: nothing submitted, both examples restored. */
export function resetDemo() {
  try {
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem(HIDDEN_KEY);
  } catch { /* nothing to clear */ }
}

/** Newest first, with the demo's own submissions above the seeded examples. */
export function allSubmissions() {
  const hidden = new Set(readList(HIDDEN_KEY));
  const submitted = readSubmitted().map(s => ({ ...s, _seeded: false }));
  const seeded = SEEDED.filter(s => !hidden.has(s.meta.id)).map(s => ({ ...s, _seeded: true }));
  return [...submitted, ...seeded];
}

export const displayName = sub => sub.patient
  ? [sub.patient.first, sub.patient.last].filter(Boolean).join(' ') || 'Patient'
  : ((sub.consent && sub.consent.printedName) || 'Returning patient');

const pad = n => String(n).padStart(2, '0');
const safe = s => String(s || '').normalize('NFKD').replace(/[^A-Za-z0-9]/g, '');

/**
 * Health number first, so a day's files sort by patient and the number a
 * chart is matched on is visible without opening anything.
 *
 *   4821567390AB_Mitchell_Sarah_2026-08-31_a7f3c891
 *
 * A submission with no health number gets NOHCN in that position rather than
 * an empty segment, so those are obvious in a folder listing and never
 * collide with each other.
 */
export function baseName(sub) {
  const d = new Date(sub.meta.submittedAt);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hcn = safe(sub.checkin && sub.checkin.ohip) || 'NOHCN';
  const last = safe(String((sub.patient && sub.patient.last)
    || (sub.consent && sub.consent.printedName) || 'Patient').trim().split(/\s+/).pop());
  const first = safe(String((sub.patient && sub.patient.first) || '').trim().split(/\s+/)[0]);
  const name = [last, first].filter(Boolean).join('_') || 'Patient';
  return `${hcn}_${name}_${date}_${sub.meta.id.slice(0, 8)}`;
}
