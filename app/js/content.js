// Form content, ported verbatim from `CareXPS Intake.dc.html` (lines 728-768).
// The design brief states this content is finalized — do not reword labels
// or edit list items without going back to the clinic.

export const SYMPTOM_GROUPS = [
  { name: 'General',         items: ['Fever', 'Chills', 'Fatigue', 'Weight loss'] },
  { name: 'Respiratory',     items: ['Cough', 'Shortness of breath', 'Sore throat', 'Wheezing'] },
  { name: 'Digestive',       items: ['Nausea', 'Vomiting', 'Diarrhea', 'Abdominal pain'] },
  { name: 'Neurological',    items: ['Headache', 'Dizziness', 'Numbness or tingling', 'Confusion'] },
  { name: 'Musculoskeletal', items: ['Joint pain', 'Muscle ache', 'Back pain'] },
  { name: 'Skin',            items: ['Rash', 'Swelling'] }
];

export const HISTORY_GROUPS = [
  { name: 'Cardiovascular', items: ['Hypertension', 'Heart disease', 'Stroke', 'High cholesterol', 'Atrial fibrillation', 'Heart attack', 'Peripheral vascular disease'] },
  { name: 'Respiratory', items: ['Asthma', 'COPD', 'Sleep apnea', 'Tuberculosis'] },
  { name: 'Endocrine', items: ['Diabetes (Type 1)', 'Diabetes (Type 2)', 'Thyroid disease', 'Osteoporosis'] },
  { name: 'Gastrointestinal', items: ['GERD / acid reflux', 'IBS', "Crohn's or colitis", 'Liver disease', 'Gallbladder disease'] },
  { name: 'Renal & Urinary', items: ['Kidney disease', 'Kidney stones', 'Recurrent UTI'] },
  { name: 'Neurological & Psychiatric', items: ['Depression', 'Anxiety', 'Seizure disorder / epilepsy', 'Migraine', 'ADHD', "Parkinson's disease"] },
  { name: 'Infectious Disease', items: ['Hepatitis', 'HIV / AIDS'] },
  { name: 'Musculoskeletal', items: ['Arthritis', 'Osteoarthritis', 'Rheumatoid arthritis', 'Fibromyalgia'] },
  { name: 'Cancer', items: ['Cancer'] },
  { name: 'Eye & ENT', items: ['Glaucoma', 'Cataracts', 'Chronic sinusitis'] },
  { name: 'Blood', items: ['Anemia', 'Blood clotting disorder'] },
  { name: 'Skin', items: ['Psoriasis', 'Eczema'] }
];

export const SURGERIES = [
  'Appendectomy', 'Tonsillectomy', 'Gallbladder removal', 'Hernia repair',
  'Hip replacement', 'Knee replacement', 'Cataract surgery', 'C-section',
  'Hysterectomy', 'Heart bypass (CABG)', 'Angioplasty / stent', 'Spinal surgery',
  'Tubal ligation', 'Wisdom teeth extraction', 'Joint arthroscopy',
  'Thyroidectomy', 'Skin lesion removal'
];

export const FAMILY_HISTORY = [
  'Heart disease', 'High blood pressure', 'Diabetes', 'Cancer', 'Stroke',
  'Mental illness', "Alzheimer's / dementia", 'Kidney disease', 'Asthma',
  'Substance use disorder', 'Genetic disorder', 'Osteoporosis'
];

export const DRUG_ALLERGIES = [
  'Penicillin', 'Sulfa drugs', 'Aspirin / NSAIDs', 'Latex',
  'Codeine / opioids', 'Local anesthetics', 'Contrast dye'
];

export const HEPATITIS_TYPES = ['A', 'B', 'C'];

// `path` gates a step to one of the two pathways ('both' shows in either).
// `conditional` steps only appear when the patient opts into a family chart.
export const STEP_META = [
  { id: 'welcome',       label: 'Welcome',              path: 'both' },
  { id: 'quickCheckin',  label: 'Quick Check-In',       path: 'quick' },
  { id: 'checkin',       label: 'Check-In',             path: 'full' },
  { id: 'patient',       label: 'Patient Information',  path: 'full' },
  { id: 'emergency',     label: 'Emergency Contact',    path: 'full' },
  { id: 'visit',         label: 'Reason for Visit',     path: 'full' },
  { id: 'allergies',     label: 'Allergies',            path: 'full' },
  { id: 'familyDoctor',  label: 'Family Doctor',        path: 'full' },
  { id: 'history',       label: 'Medical History',      path: 'full', conditional: true },
  { id: 'surgeries',     label: 'Past Surgeries',       path: 'full', conditional: true },
  { id: 'medications',   label: 'Medications',          path: 'full', conditional: true },
  { id: 'familyHistory', label: 'Family History',       path: 'full', conditional: true },
  { id: 'consent',       label: 'Consent & Signature',  path: 'full' },
  { id: 'done',          label: 'Done',                 path: 'both' }
];

export const CONSENT_PARAGRAPHS = [
  'I consent to receive care from CareXPS Urgent Care and its clinicians for the assessment and treatment of the condition described in this intake form. I understand that treatment recommendations will be explained to me and that I may ask questions at any time.',
  'I understand that the personal health information I provide will be used to deliver my care, will be kept confidential, and will be shared only with my consent or as required by law.',
  'I understand that no guarantee has been made about the outcome of any examination or treatment, and that I may withdraw my consent to treatment at any time.'
];

export const CLINIC = {
  name: 'CareXPS Urgent Care',
  address: '1030 Gordon St, Suite 102, Guelph, ON'
};

export const PROVINCES = [
  ['ON', 'Ontario'], ['QC', 'Quebec'], ['BC', 'British Columbia'], ['AB', 'Alberta'],
  ['MB', 'Manitoba'], ['SK', 'Saskatchewan'], ['NS', 'Nova Scotia'],
  ['NB', 'New Brunswick'], ['NL', 'Newfoundland'], ['PE', 'PEI']
];

export const SEX_OPTIONS = ['Female', 'Male', 'Other', 'Prefer not to say'];
export const MARITAL_OPTIONS = ['Single', 'Married', 'Common-law', 'Divorced', 'Widowed'];
export const FREQUENCY_OPTIONS = ['Constant', 'Intermittent', 'Comes and goes'];
export const TREND_OPTIONS = ['Improving', 'Worsening', 'Unchanged'];

// Booked or walk-in. Asked on both pathways, because it decides which queue
// the front desk puts someone in before anything clinical matters.
export const APPOINTMENT_OPTIONS = [
  ['yes', 'Yes, I have an appointment'],
  ['no', "No, I'm a walk-in"]
];

export const CHECKIN_OPTIONS = [
  { id: 'scan',   title: 'Scan health card',    desc: 'Take a photo of the front of your OHIP card' },
  { id: 'manual', title: 'Enter OHIP number',   desc: 'Type your health number in manually' },
  { id: 'none',   title: "I don't have my card", desc: 'Continue without a health card number' }
];

export const FAMILY_DOCTOR_TILES = [
  { value: 'yes', title: 'Yes, sign me up', desc: "We'll ask a few extra health-history questions to set up your family chart." },
  { value: 'no',  title: 'No, not today',   desc: "We'll skip the extra history questions and go straight to your visit summary." }
];

export const PATHWAY_TILES = [
  { value: 'quick', title: "I've been here before", desc: "Quick check-in — scan your card, tell us why you're here, done.", icon: 'card' },
  { value: 'full',  title: 'First time here',       desc: 'Full registration — a few more questions to set up your chart.', icon: 'person' }
];
