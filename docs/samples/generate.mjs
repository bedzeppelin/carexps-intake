// Temporary generator for docs/samples/. Uses the app's real exporters so the
// sample files handed to Alembico cannot drift from the shipping code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCsv, csvHeader, csvRow } from '../../app/js/exporters/csv.js';
import { toFhirBundle } from '../../app/js/exporters/fhir.js';
import { toClinicalNote } from '../../app/js/exporters/note.js';

const CLINIC = 'CareXPS Urgent Care';
const ADDRESS = '1030 Gordon St, Suite 102, Guelph, ON';

const full = {
  meta: {
    id: 'a7f3c891-4d02-4b16-9e58-2c7d10ab55f9',
    formVersion: '1.0', clinic: CLINIC, clinicAddress: ADDRESS, pathway: 'full',
    startedAt: '2026-08-29T14:31:08.412Z', submittedAt: '2026-08-29T14:42:19.907Z'
  },
  checkin: { method: 'manual', ohip: '4821567390AB' },
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
    signedAt: '2026-08-29T14:42:11.220Z'
    // signaturePng omitted from the samples for length; it is present in
    // real submissions as a data:image/png;base64 URI of roughly 20-30 KB.
  }
};

const noFamilyDoctor = {
  meta: {
    id: 'c93a0f56-71be-4c28-a4d7-08bb2e6d4415',
    formVersion: '1.0', clinic: CLINIC, clinicAddress: ADDRESS, pathway: 'full',
    startedAt: '2026-08-29T13:28:55.700Z', submittedAt: '2026-08-29T13:39:48.213Z'
  },
  checkin: { method: 'manual', ohip: '3178462095CD' },
  visit: {
    problem: 'Twisted left ankle playing soccer on Saturday',
    onset: 'Saturday afternoon', pain: 6, workInjury: 'no', mva: 'no',
    symptoms: ['Joint pain', 'Swelling'],
    symptomOther: '', frequency: 'Intermittent', trend: 'Improving'
  },
  patient: {
    first: 'Priya', last: 'Raghavan', address: '88 Wellington St E', city: 'Guelph',
    province: 'ON', postal: 'N1H 3T9', homePhone: '', cellPhone: '647-330-1182',
    email: 'priya.raghavan@example.ca', dob: '1994-11-02', sex: 'Female', marital: 'Single'
  },
  emergencyContacts: [{ name: 'Anil Raghavan', phone: '647-330-2274' }],
  allergies: { noKnownDrugAllergies: true, drugs: [], other: [] },
  familyDoctorRequested: 'no',
  consent: {
    agreed: true, printedName: 'Priya Raghavan', signed: true,
    signedAt: '2026-08-29T13:39:40.882Z'
  }
};

const quick = {
  meta: {
    id: 'd5b8c2a4-30f7-4e93-b1c6-9a7f45d0e812',
    formVersion: '1.0', clinic: CLINIC, clinicAddress: ADDRESS, pathway: 'quick',
    startedAt: '2026-08-29T12:47:02.330Z', submittedAt: '2026-08-29T12:50:31.744Z'
  },
  checkin: { method: 'manual', ohip: '5930284617XY' },
  visit: { problem: 'Sore throat and fever for three days', pain: 4 }
};

const all = [full, noFamilyDoctor, quick];
// fileURLToPath, not pathname: a file:// pathname is "/C:/..." on Windows but
// "/home/..." on Linux, so trimming the leading slash works on one and breaks
// the other. Writes land beside this script whichever runs it.
const here = path.dirname(fileURLToPath(import.meta.url));
const out = f => path.join(here, f);
const write = (f, text) => { fs.writeFileSync(out(f), text); console.log('  ' + f); };

console.log('Writing docs/samples/');

write('full-registration.json', JSON.stringify(full, null, 2) + '\n');
write('full-registration.csv', toCsv(full));
write('full-registration.fhir.json', JSON.stringify(toFhirBundle(full), null, 2) + '\n');
write('full-registration.txt', toClinicalNote(full) + '\n');

write('quick-checkin.json', JSON.stringify(quick, null, 2) + '\n');
write('quick-checkin.csv', toCsv(quick));
write('quick-checkin.txt', toClinicalNote(quick) + '\n');

// One file, one row per submission — the shape a bulk loader wants.
write('batch.csv', '﻿' + csvHeader() + '\r\n' + all.map(csvRow).join('\r\n') + '\r\n');

console.log('\nColumns in the CSV: ' + csvHeader().split(',').length);
console.log('FHIR resources (full): ' + toFhirBundle(full).entry.map(e => e.resource.resourceType).join(', '));
