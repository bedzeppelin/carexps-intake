// The staff-facing receipt. Ported from the design's receiptSections
// (lines 977-1034), but derived from the canonical submission so the printed
// receipt and the machine exports can never disagree.

const DASH = '\u2014';
const or = v => (v != null && String(v).trim() !== '' ? String(v) : DASH);
const listOr = a => (a && a.length ? a.join(', ') : DASH);
const ynOr = v => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'na' ? 'N/A' : DASH;

const arrival = sub =>
  sub.checkin?.appointment === 'yes'
    ? `Appointment${sub.checkin.appointmentTime ? ' at ' + sub.checkin.appointmentTime : ''}`
    : sub.checkin?.appointment === 'no' ? 'Walk-in' : DASH;

export function receiptSections(sub) {
  if (sub.meta.pathway === 'quick') {
    const q = sub.patient || {};
    return [{
      title: 'Quick Check-In',
      rows: [
        { label: 'Name', value: or([q.first, q.last].filter(Boolean).join(' ')) },
        { label: 'DOB', value: or(q.dob) },
        { label: 'Method', value: or(sub.checkin.method) },
        { label: 'OHIP #', value: or(sub.checkin.ohip) },
        { label: 'Arrival', value: arrival(sub) },
        { label: 'Reason for visit', value: or(sub.visit.problem) },
        { label: 'Pain (0-10)', value: String(sub.visit.pain) }
      ]
    }];
  }

  const p = sub.patient || {};
  const sections = [
    {
      title: 'Patient Information',
      rows: [
        { label: 'Name', value: or([p.first, p.last].filter(Boolean).join(' ')) },
        { label: 'DOB', value: or(p.dob) },
        { label: 'Sex', value: or(p.sex) },
        { label: 'Marital status', value: or(p.marital) },
        { label: 'Phone', value: or(p.cellPhone || p.homePhone) },
        { label: 'Email', value: or(p.email) },
        { label: 'Address', value: or([p.address, p.city, p.province, p.postal].filter(Boolean).join(', ')) }
      ]
    },
    {
      title: 'Check-In',
      rows: [
        { label: 'Method', value: or(sub.checkin.method) },
        { label: 'OHIP #', value: or(sub.checkin.ohip) },
        { label: 'Arrival', value: arrival(sub) }
      ]
    },
    {
      title: 'Emergency Contacts',
      rows: (sub.emergencyContacts || []).length
        ? sub.emergencyContacts.map(c => ({ label: c.name, value: or(c.phone) }))
        : [{ label: 'None given', value: DASH }]
    },
    {
      title: 'Reason for Visit',
      rows: [
        { label: 'Problem', value: or(sub.visit.problem) },
        { label: 'Onset', value: or(sub.visit.onset) },
        { label: 'Pain (0-10)', value: String(sub.visit.pain) },
        { label: 'Work injury', value: ynOr(sub.visit.workInjury) },
        { label: 'MVA', value: ynOr(sub.visit.mva) },
        { label: 'Symptoms', value: listOr(sub.visit.symptoms) },
        { label: 'Other symptom', value: or(sub.visit.symptomOther) },
        { label: 'Frequency', value: or(sub.visit.frequency) },
        { label: 'Trend', value: or(sub.visit.trend) }
      ]
    },
    {
      title: 'Allergies',
      rows: [
        {
          label: 'Drug allergies',
          value: sub.allergies.noKnownDrugAllergies ? 'None known' : listOr(sub.allergies.drugs)
        },
        ...sub.allergies.other.map(a => ({ label: a.allergen, value: or(a.reaction) }))
      ]
    },
    {
      title: 'Family Doctor',
      rows: [{ label: 'Becoming a patient', value: ynOr(sub.familyDoctorRequested) }]
    }
  ];

  if (sub.medicalHistory) {
    sections.push({
      title: 'Medical History',
      rows: [
        { label: 'Conditions', value: listOr(sub.medicalHistory.conditions) },
        ...(sub.medicalHistory.hepatitisTypes.length
          ? [{ label: 'Hepatitis type', value: sub.medicalHistory.hepatitisTypes.join(', ') }] : []),
        ...(sub.medicalHistory.cancerType
          ? [{ label: 'Cancer type', value: sub.medicalHistory.cancerType }] : [])
      ]
    });
    sections.push({
      title: 'Past Surgeries',
      rows: [
        { label: 'Surgeries', value: listOr(sub.surgeries.items) },
        { label: 'Other', value: or(sub.surgeries.other) }
      ]
    });
    const meds = [
      ...sub.medications.prescription.map(m => ({
        label: m.name, value: or([m.dose, m.frequency].filter(Boolean).join(' '))
      })),
      ...sub.medications.nonPrescription.map(m => ({
        label: `${m.name} (OTC)`, value: or([m.dose, m.frequency].filter(Boolean).join(' '))
      }))
    ];
    sections.push({
      title: 'Medications',
      rows: meds.length ? meds : [{ label: 'None reported', value: DASH }]
    });
    sections.push({
      title: 'Family History',
      rows: [
        { label: 'Conditions', value: listOr(sub.familyHistory.conditions) },
        { label: 'Other', value: or(sub.familyHistory.other) },
        { label: 'Pregnant', value: ynOr(sub.familyHistory.pregnant) },
        ...(sub.familyHistory.pregnant === 'yes'
          ? [{ label: 'Weeks', value: or(sub.familyHistory.weeks) }] : [])
      ]
    });
  }

  if (sub.consent) {
    sections.push({
      title: 'Consent',
      rows: [
        { label: 'Agreed', value: sub.consent.agreed ? 'Yes' : 'No' },
        { label: 'Printed name', value: or(sub.consent.printedName) },
        { label: 'Signed', value: sub.consent.signed ? 'Yes' : 'No' },
        { label: 'Date', value: new Date(sub.meta.submittedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) }
      ]
    });
  }

  return sections;
}
