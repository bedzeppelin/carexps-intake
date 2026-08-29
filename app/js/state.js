// Session state. Deliberately a plain in-memory object with no persistence
// layer: on a shared kiosk, nothing patient-identifiable may outlive the
// session. See project plan section 3 — no localStorage, sessionStorage,
// IndexedDB or cookies anywhere in this app.

import { STEP_META } from './content.js';

const blankRow = () => ({ name: '', dose: '', freq: '' });

export function createSession() {
  return {
    step: 'welcome',
    // 'idle' until a card photo is taken; 'captured' shows the confirm panel.
    // The photo itself is never retained — only this flag.
    scanState: 'idle',
    expandedGroups: { Cardiovascular: true, Respiratory: true, Endocrine: true },
    errors: {},
    hasSignature: false,
    signatureDataUrl: null,
    staffView: false,
    startedAt: new Date().toISOString(),
    data: {
      checkin: { method: null, ohip: '' },
      patient: {
        first: '', last: '', address: '', city: '', province: 'ON', postal: '',
        homePhone: '', cellPhone: '', email: '', dob: '', sex: '', marital: ''
      },
      emergency: { contacts: [{ name: '', phone: '' }, { name: '', phone: '' }] },
      visit: {
        problem: '', onset: '', pain: 5, workInjury: null, mva: null,
        symptoms: [], symptomOther: '', frequency: '', trend: ''
      },
      allergies: {
        pairs: [
          { allergen: '', reaction: '' }, { allergen: '', reaction: '' },
          { allergen: '', reaction: '' }, { allergen: '', reaction: '' }
        ],
        drugs: [], noKnown: false
      },
      pathway: null,
      familyDoctor: null,
      history: { items: [], hepSub: [], cancerType: '' },
      surgeries: { items: [], other: '' },
      medications: {
        prescription: [blankRow(), blankRow(), blankRow(), blankRow()],
        nonPrescription: [blankRow(), blankRow(), blankRow(), blankRow()]
      },
      familyHistory: { items: [], other: '', pregnant: null, weeks: '' },
      consent: { agree: false, printedName: '' }
    }
  };
}

export const setField = (s, section, key, value) => { s.data[section][key] = value; };

export const setIndexed = (s, section, listKey, idx, key, value) => {
  s.data[section][listKey][idx][key] = value;
};

export function toggleItem(s, section, listKey, value) {
  const list = s.data[section][listKey];
  const at = list.indexOf(value);
  if (at === -1) list.push(value); else list.splice(at, 1);
  return at === -1;
}

export const isSelected = (s, section, listKey, value) =>
  s.data[section][listKey].includes(value);

// Which steps are live for this session. Ported from the design's
// activeSteps() (lines 860-863): pathway gates most steps, and the four
// conditional ones only appear if the patient wants a family chart.
export function activeSteps(s) {
  const p = s.data.pathway;
  return STEP_META.filter(step =>
    (step.path === 'both' || step.path === p) &&
    (!step.conditional || s.data.familyDoctor === 'yes')
  );
}

// Steps that earn a progress segment. Welcome and Done are chrome, not work.
export const countedSteps = s => activeSteps(s).filter(x => x.id !== 'welcome' && x.id !== 'done');

export function stepIndex(s) {
  return activeSteps(s).findIndex(x => x.id === s.step);
}

export function nextStepId(s) {
  const seq = activeSteps(s);
  const i = seq.findIndex(x => x.id === s.step);
  return i >= 0 && i < seq.length - 1 ? seq[i + 1].id : null;
}

export function prevStepId(s) {
  const seq = activeSteps(s);
  const i = seq.findIndex(x => x.id === s.step);
  return i > 0 ? seq[i - 1].id : null;
}

// Ontario health numbers are ten digits followed by a two-letter version
// code. The version code is missing from some older cards, so it is accepted
// as optional — but the ten digits are not negotiable, because a mistyped
// health number is worse than no health number at all: it silently points at
// somebody else.
export const normalizeOhip = v => String(v || '').replace(/[\s-]/g, '').toUpperCase();
export const ohipLooksValid = v => /^\d{10}[A-Z]{0,2}$/.test(normalizeOhip(v));

// Shared by both check-in screens. Choosing a method is a promise to complete
// it: picking "Scan health card" and then walking past without taking a photo
// or entering a number left the clinic with nothing, which was the whole point
// of asking.
export function validateCheckin(s, errs) {
  const c = s.data.checkin;
  if (!c.method) { errs.method = true; return errs; }

  if (c.method === 'scan' && s.scanState !== 'captured') errs.scanPhoto = true;

  if (c.method === 'scan' || c.method === 'manual') {
    if (!c.ohip.trim()) errs.ohip = true;
    else if (!ohipLooksValid(c.ohip)) errs.ohipFormat = true;
  }
  // 'none' is a deliberate answer, not an omission — nothing more to require.
  return errs;
}

// Validation for the current step. Extends the design's validate()
// (lines 844-859) with the rules the design marked required but never
// enforced: the reason for visit, the first emergency contact, and actually
// completing whichever check-in method the patient chose.
export function validate(s) {
  const { step, data: d } = s;
  const errs = {};

  if (step === 'checkin') {
    validateCheckin(s, errs);
  }
  if (step === 'quickCheckin') {
    validateCheckin(s, errs);
    if (!d.visit.problem.trim()) errs.problem = true;
  }
  if (step === 'patient') {
    if (!d.patient.first.trim()) errs.first = true;
    if (!d.patient.last.trim()) errs.last = true;
    if (!d.patient.dob) errs.dob = true;
  }
  if (step === 'emergency') {
    if (!d.emergency.contacts[0].name.trim()) errs.contactName = true;
  }
  if (step === 'visit') {
    if (!d.visit.problem.trim()) errs.problem = true;
  }
  if (step === 'familyDoctor') {
    if (!d.familyDoctor) errs.choice = true;
  }
  if (step === 'consent') {
    if (!d.consent.agree) errs.agree = true;
    if (!d.consent.printedName.trim()) errs.printedName = true;
    if (!s.hasSignature) errs.signature = true;
  }
  return errs;
}

// Pain scale bands, from the design (lines 906-907).
export const painLabel = v =>
  v === 0 ? 'No pain' : v <= 3 ? 'Mild pain' : v <= 6 ? 'Moderate pain'
  : v <= 9 ? 'Severe pain' : 'Worst pain possible';

export const painColor = v =>
  v <= 3 ? 'var(--confirm-green)' : v <= 6 ? 'var(--amber)' : 'var(--alert-red)';

export const todayDisplay = () =>
  new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
