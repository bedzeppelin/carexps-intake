// FHIR R4 collection Bundle.
//
// The intake checklists are plain patient-facing wording, not coded
// terminology, so most CodeableConcepts carry `text` only — valid R4, and
// honest about provenance. If Alembico later wants SNOMED or ICD codes, the
// mapping belongs here, in one place.

const uuid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));

const cc = text => ({ text });
const ref = id => ({ reference: `urn:uuid:${id}` });

export function toFhirBundle(sub) {
  const entries = [];
  const add = resource => {
    entries.push({ fullUrl: `urn:uuid:${resource.id}`, resource });
    return resource.id;
  };

  const patientId = uuid();
  const patient = { resourceType: 'Patient', id: patientId };
  if (sub.patient) {
    patient.name = [{
      use: 'official',
      family: sub.patient.last || undefined,
      given: [sub.patient.first].filter(Boolean)
    }];
    if (sub.patient.dob) patient.birthDate = sub.patient.dob;
    const gender = { Female: 'female', Male: 'male', Other: 'other' }[sub.patient.sex];
    if (gender) patient.gender = gender;
    else if (sub.patient.sex) patient.gender = 'unknown';
    const telecom = [];
    if (sub.patient.cellPhone) telecom.push({ system: 'phone', value: sub.patient.cellPhone, use: 'mobile' });
    if (sub.patient.homePhone) telecom.push({ system: 'phone', value: sub.patient.homePhone, use: 'home' });
    if (sub.patient.email) telecom.push({ system: 'email', value: sub.patient.email });
    if (telecom.length) patient.telecom = telecom;
    if (sub.patient.address || sub.patient.city || sub.patient.postal) {
      patient.address = [{
        line: [sub.patient.address].filter(Boolean),
        city: sub.patient.city || undefined,
        state: sub.patient.province || undefined,
        postalCode: sub.patient.postal || undefined,
        country: 'CA'
      }];
    }
    if (sub.patient.marital) patient.maritalStatus = cc(sub.patient.marital);
  } else if (sub.consent?.printedName) {
    patient.name = [{ text: sub.consent.printedName }];
  }
  if (sub.checkin?.ohip) {
    patient.identifier = [{
      system: 'https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-patient-hcn',
      value: sub.checkin.ohip
    }];
  }
  for (const c of sub.emergencyContacts || []) {
    patient.contact = patient.contact || [];
    patient.contact.push({
      relationship: [cc('Emergency contact')],
      name: { text: c.name },
      telecom: c.phone ? [{ system: 'phone', value: c.phone }] : undefined
    });
  }
  add(patient);

  const encounterId = uuid();
  // A booked visit is ambulatory; an unbooked one at an urgent care is closer
  // to emergency. Carrying the patient's own answer in `type` as well keeps it
  // legible without having to infer it back out of the class code.
  const booked = sub.checkin?.appointment === 'yes';
  add({
    resourceType: 'Encounter', id: encounterId, status: 'in-progress',
    class: booked
      ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' }
      : { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
    type: sub.checkin?.appointment
      ? [cc(booked
          ? `Booked appointment${sub.checkin.appointmentTime ? ' at ' + sub.checkin.appointmentTime : ''}`
          : 'Walk-in')]
      : undefined,
    subject: ref(patientId),
    period: { start: sub.meta.submittedAt },
    reasonCode: sub.visit?.problem ? [cc(sub.visit.problem)] : undefined,
    serviceProvider: { display: sub.meta.clinic }
  });
  const ctx = { encounter: ref(encounterId), subject: ref(patientId) };
  const stamp = sub.meta.submittedAt;

  if (sub.visit?.pain != null) {
    add({
      resourceType: 'Observation', id: uuid(), status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '72514-3', display: 'Pain severity - 0-10 verbal numeric rating' }] },
      ...ctx, effectiveDateTime: stamp,
      valueQuantity: { value: sub.visit.pain, system: 'http://unitsofmeasure.org', code: '{score}' }
    });
  }

  const symptoms = [...(sub.visit?.symptoms || [])];
  if (sub.visit?.symptomOther) symptoms.push(sub.visit.symptomOther);
  for (const text of symptoms) {
    add({
      resourceType: 'Condition', id: uuid(),
      clinicalStatus: cc('active'), verificationStatus: cc('unconfirmed'),
      category: [cc('Encounter Diagnosis')],
      code: cc(text), ...ctx, recordedDate: stamp
    });
  }

  for (const text of sub.medicalHistory?.conditions || []) {
    const label =
      text === 'Hepatitis' && sub.medicalHistory.hepatitisTypes?.length
        ? `Hepatitis ${sub.medicalHistory.hepatitisTypes.join('/')}`
        : text === 'Cancer' && sub.medicalHistory.cancerType
          ? `Cancer — ${sub.medicalHistory.cancerType}`
          : text;
    add({
      resourceType: 'Condition', id: uuid(),
      clinicalStatus: cc('active'), verificationStatus: cc('unconfirmed'),
      category: [cc('Problem List Item')],
      code: cc(label), subject: ref(patientId), recordedDate: stamp
    });
  }

  if (sub.allergies?.noKnownDrugAllergies) {
    add({
      resourceType: 'AllergyIntolerance', id: uuid(),
      clinicalStatus: cc('active'), verificationStatus: cc('confirmed'),
      code: { coding: [{ system: 'http://snomed.info/sct', code: '409137002', display: 'No known drug allergy' }] },
      patient: ref(patientId), recordedDate: stamp
    });
  }
  for (const drug of sub.allergies?.drugs || []) {
    add({
      resourceType: 'AllergyIntolerance', id: uuid(),
      clinicalStatus: cc('active'), verificationStatus: cc('unconfirmed'),
      category: ['medication'], code: cc(drug),
      patient: ref(patientId), recordedDate: stamp
    });
  }
  for (const a of sub.allergies?.other || []) {
    add({
      resourceType: 'AllergyIntolerance', id: uuid(),
      clinicalStatus: cc('active'), verificationStatus: cc('unconfirmed'),
      code: cc(a.allergen), patient: ref(patientId), recordedDate: stamp,
      reaction: a.reaction ? [{ manifestation: [cc(a.reaction)] }] : undefined
    });
  }

  const surgeries = [...(sub.surgeries?.items || [])];
  if (sub.surgeries?.other) surgeries.push(sub.surgeries.other);
  for (const text of surgeries) {
    add({
      resourceType: 'Procedure', id: uuid(), status: 'completed',
      code: cc(text), subject: ref(patientId)
    });
  }

  const meds = [
    ...(sub.medications?.prescription || []).map(m => ({ ...m, otc: false })),
    ...(sub.medications?.nonPrescription || []).map(m => ({ ...m, otc: true }))
  ];
  for (const m of meds) {
    add({
      resourceType: 'MedicationStatement', id: uuid(), status: 'active',
      medicationCodeableConcept: cc(m.otc ? `${m.name} (non-prescription)` : m.name),
      subject: ref(patientId), dateAsserted: stamp,
      dosage: (m.dose || m.frequency)
        ? [{ text: [m.dose, m.frequency].filter(Boolean).join(' ') }] : undefined
    });
  }

  const famConditions = [...(sub.familyHistory?.conditions || [])];
  if (sub.familyHistory?.other) famConditions.push(sub.familyHistory.other);
  if (famConditions.length) {
    add({
      resourceType: 'FamilyMemberHistory', id: uuid(), status: 'completed',
      patient: ref(patientId), date: stamp,
      relationship: cc('Immediate family'),
      condition: famConditions.map(text => ({ code: cc(text) }))
    });
  }
  if (sub.familyHistory?.pregnant === 'yes') {
    add({
      resourceType: 'Observation', id: uuid(), status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '11884-4', display: 'Gestational age Estimated' }] },
      ...ctx, effectiveDateTime: stamp,
      valueQuantity: sub.familyHistory.weeks
        ? { value: Number(sub.familyHistory.weeks), unit: 'weeks', system: 'http://unitsofmeasure.org', code: 'wk' }
        : undefined,
      note: sub.familyHistory.weeks
        ? undefined : [{ text: 'Patient reports possible pregnancy; weeks not stated.' }]
    });
  }

  if (sub.consent) {
    add({
      resourceType: 'Consent', id: uuid(),
      status: sub.consent.agreed ? 'active' : 'rejected',
      scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IDSCL' }] }],
      patient: ref(patientId),
      dateTime: sub.consent.signedAt || stamp,
      sourceAttachment: sub.consent.signaturePng
        ? { contentType: 'image/png', title: 'Patient signature' } : undefined
    });
  }

  return {
    resourceType: 'Bundle', id: sub.meta.id, type: 'collection',
    timestamp: stamp, entry: entries
  };
}
