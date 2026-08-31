// The canonical submission object. Every other export — CSV, FHIR, the
// clinical note, the receipt, and the payload the PC service turns into a
// PDF — is derived from this one shape, so they can never drift apart.

import { CLINIC } from '../content.js';
import { normalizeOhip } from '../state.js';

// 1.1 added checkin.appointment / appointmentTime, and made `patient` present
// on both pathways: a quick check-in now always carries first, last and dob.
export const FORM_VERSION = '1.1';

const clean = s => (typeof s === 'string' ? s.trim() : s);
const nonEmpty = obj => Object.values(obj).some(v => clean(v));

export function newSubmissionId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function buildSubmission(session, { includeSignature = true } = {}) {
  const d = session.data;
  const quick = d.pathway === 'quick';
  const extended = !quick && d.familyDoctor === 'yes';

  const out = {
    meta: {
      id: session.submissionId || newSubmissionId(),
      formVersion: FORM_VERSION,
      clinic: CLINIC.name,
      clinicAddress: CLINIC.address,
      pathway: d.pathway,
      startedAt: session.startedAt,
      submittedAt: new Date().toISOString()
    },
    // Exported without separators and upper-cased, so a number typed as
    // "1234-567-890-ab" and one typed as "1234 567 890 AB" do not look like
    // two different patients downstream.
    checkin: {
      method: d.checkin.method,
      ohip: normalizeOhip(d.checkin.ohip),
      appointment: d.checkin.appointment,
      appointmentTime: clean(d.checkin.appointmentTime)
    },
    visit: {
      problem: clean(d.visit.problem),
      onset: clean(d.visit.onset),
      pain: d.visit.pain,
      workInjury: d.visit.workInjury,
      mva: d.visit.mva,
      symptoms: [...d.visit.symptoms],
      symptomOther: clean(d.visit.symptomOther),
      frequency: d.visit.frequency,
      trend: d.visit.trend
    }
  };

  if (quick) {
    // The returning-patient path collects identity and reason only — but it
    // does collect identity. Name and date of birth are what let the clinic
    // find the chart when someone arrives without their card.
    out.patient = {
      first: clean(d.patient.first),
      last: clean(d.patient.last),
      dob: d.patient.dob
    };
    delete out.visit.onset;
    delete out.visit.symptoms;
    delete out.visit.symptomOther;
    delete out.visit.frequency;
    delete out.visit.trend;
    delete out.visit.workInjury;
    delete out.visit.mva;
    return out;
  }

  out.patient = { ...d.patient };
  Object.keys(out.patient).forEach(k => { out.patient[k] = clean(out.patient[k]); });
  out.emergencyContacts = d.emergency.contacts.filter(nonEmpty).map(c => ({
    name: clean(c.name), phone: clean(c.phone)
  }));
  out.allergies = {
    noKnownDrugAllergies: d.allergies.noKnown,
    drugs: [...d.allergies.drugs],
    other: d.allergies.pairs.filter(nonEmpty).map(p => ({
      allergen: clean(p.allergen), reaction: clean(p.reaction)
    }))
  };
  out.familyDoctorRequested = d.familyDoctor;

  if (extended) {
    out.medicalHistory = {
      conditions: [...d.history.items],
      hepatitisTypes: [...d.history.hepSub],
      cancerType: clean(d.history.cancerType)
    };
    out.surgeries = { items: [...d.surgeries.items], other: clean(d.surgeries.other) };
    out.medications = {
      prescription: d.medications.prescription.filter(nonEmpty).map(mapMed),
      nonPrescription: d.medications.nonPrescription.filter(nonEmpty).map(mapMed)
    };
    out.familyHistory = {
      conditions: [...d.familyHistory.items],
      other: clean(d.familyHistory.other),
      pregnant: d.familyHistory.pregnant,
      weeks: clean(d.familyHistory.weeks)
    };
  }

  out.consent = {
    agreed: d.consent.agree,
    printedName: clean(d.consent.printedName),
    signed: !!session.hasSignature,
    signedAt: new Date().toISOString()
  };
  if (includeSignature && session.hasSignature) {
    out.consent.signaturePng = session.signaturePad?.toDataUrl() || session.signatureDataUrl || null;
  }
  return out;
}

const mapMed = m => ({ name: clean(m.name), dose: clean(m.dose), frequency: clean(m.freq) });

export const patientDisplayName = sub =>
  sub.patient ? [sub.patient.first, sub.patient.last].filter(Boolean).join(' ')
              : (sub.consent?.printedName || 'Patient');
