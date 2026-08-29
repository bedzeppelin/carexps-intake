# CareXPS digital intake — integration notes for Alembico

CareXPS Urgent Care (1030 Gordon St, Suite 102, Guelph, ON) replaced its paper
intake form with a tablet flow. A completed form is rendered to PDF and filed
into the clinic's OneDrive within a couple of seconds, and staff get a clinical
note they can paste into Alembico by hand.

**The paste is the part we want to remove.** This document is what you need to
tell us whether that is possible, and how.

There is also a working console you can click through, with the same data and
downloadable exports:
<https://claude.ai/code/artifact/615f1328-3e8b-4941-b063-d9ac80d8f5c8>

Everything in this document and in `samples/` is **synthetic test data** —
invented names, invented health numbers. No real patient information is
included.

---

## 1. What we need from you

Four questions. The first is the blocking one.

### 1.1 Is there an interface we can post to at all?

Any of these would work, in descending order of preference. We are not asking
you to build anything new — we are asking which of these already exists:

- An HTTP API accepting an encounter or document for a patient
- An HL7 v2 feed (`MDM^T02` or `ADT^A04`) over MLLP or a file drop
- A FHIR R4 endpoint — we already produce a conformant bundle, see `samples/full-registration.fhir.json`
- A watched folder Alembico ingests from, with a filename or sidecar convention
- Nothing — in which case staff keep pasting, and we would like that confirmed
  in writing so we stop asking

Public directory listings say Alembico has no API. Alembico's own marketing
describes interface-level integrations. Those disagree, which is why nothing has
been guessed at in code: `desk-service/src/alembico.js` ships as a documented,
**disabled** stub rather than a wrong assumption.

### 1.2 How does Alembico identify which chart this belongs to?

Every submission carries an Ontario health number, normalised to ten digits plus
an optional two-letter version code, separators stripped, upper-cased —
`4821567390AB`.

- Does Alembico accept that as a lookup key, or does it need your own internal
  patient ID?
- What should happen when the number matches nobody — create the chart, or hold
  the encounter for staff to reconcile?

Roughly one submission in eight is a first-time patient with no chart yet, so
the "no match" path is not an edge case for us.

### 1.3 What does the encounter body look like?

We can send any of four representations of the same submission, all generated
from one canonical object so they cannot drift apart. All four are in
`samples/`. Tell us which you want and we will send that one.

Also: can we attach the signed PDF to the encounter, or does the note have to
carry everything?

### 1.4 How do we authenticate, and is there a test environment?

Bearer token, mutual TLS, IP allowlist, something else? The credential will live
on the clinic PC only — never on a tablet, which is a screen in a public room.

We would also like a non-production target to send test submissions to before
anything touches a real chart.

---

## 2. How a submission travels

Five stages, in this order, deliberately.

| | Stage | What happens |
|---|---|---|
| 1 | Patient submits on a tablet | Kiosk tablet on the clinic wifi `POST`s the submission JSON to the clinic PC over HTTPS. The tablet holds no credentials for OneDrive or Alembico and stores nothing between patients. |
| 2 | Desk service spools it | The raw submission is written to a local spool and `fsync`ed before any work starts. If the PC loses power mid-render, the form survives and replays on next start. |
| 3 | PDF is rendered and filed | Written atomically into the clinic's synced OneDrive folder as `Intake_Mitchell_Sarah_2026-08-29_1042_a7f3c891.pdf`. |
| 4 | Front desk is notified | The submission appears in the console with a **New** chip. Staff currently open the note, select it, and paste it into the patient's Alembico encounter by hand. |
| 5 | **Push to Alembico — not built** | The clinic PC posts the encounter to Alembico, which files it against the patient matched on their health number. |

The order matters: the tablet clears a patient's answers on a `200` and on
nothing else, and the desk service returns `200` only once the PDF is confirmed
on disk. If anything fails, the spool entry survives, the tablet offers a retry,
and the next service start replays what is queued.

Stage 5 sits **after** the PDF is safely filed on purpose. An EMR outage must
never cost the clinic a completed intake form.

---

## 3. Matching on the health number

The suggestion was to key on the health card number, possibly through the
filename. That works, with one caveat worth raising before it gets built.

**A health number in a filename is health information in a place that is not
protected like health information.** Filenames travel further than file
contents: they appear in OneDrive sync logs, backup indexes, folder listings,
and any support ticket where someone pastes a directory. The current build
deliberately keeps identifiers out of filenames and logs for exactly this
reason.

So the preference is to match on a **field in the payload** rather than the
filename. If a watched folder is the only integration Alembico offers, a sidecar
`.json` next to each PDF carries the number without putting it in the name. If
the filename genuinely has to carry it, we will build that — it is the clinic's
call, not ours — but it should be a decision someone made rather than one that
happened.

| Option | Where the number lives | Works if Alembico offers | PHI exposure |
|---|---|---|---|
| **Field in the request body** (preferred) | `patientIdentifier.value` | An HTTP API, FHIR, or HL7 | Payload only — encrypted in transit, not logged |
| **Sidecar JSON beside the PDF** | `manifest.json` → `ohip` | A watched folder | File contents only — filename stays clean |
| **Encoded in the filename** | `4821567390AB_2026-08-29.pdf` | A watched folder with no sidecar support | Visible in sync logs, backups, folder listings |

---

## 4. The data contract

One canonical submission object. The PDF, the note, the CSV and the FHIR bundle
are all derived from it, so they can never disagree. It is built by
[`app/js/exporters/submission.js`](../app/js/exporters/submission.js).

Two pathways produce two shapes, and the difference matters for anything
consuming this.

| Key | Type | `quick` | `full` | Notes |
|---|---|---|---|---|
| `meta` | object | always | always | Reference id, form version, clinic, pathway, timestamps |
| `checkin` | object | always | always | `method` is `scan`, `manual` or `none`; `ohip` normalised |
| `visit` | object | reduced | always | Quick check-in carries reason and pain only |
| `patient` | object | absent | always | Name, DOB, sex, marital status, address, phones, email |
| `emergencyContacts` | array | absent | always | Empty rows are dropped before sending |
| `allergies` | object | absent | always | `noKnownDrugAllergies` is an explicit answer, not an empty list |
| `familyDoctorRequested` | `"yes"` \| `"no"` | absent | always | Gates the four conditional sections below |
| `medicalHistory` | object | absent | conditional | Only when `familyDoctorRequested === "yes"` |
| `surgeries` | object | absent | conditional | Checklist plus free text |
| `medications` | object | absent | conditional | Prescription and non-prescription, each name / dose / frequency |
| `familyHistory` | object | absent | conditional | Includes pregnancy status and gestational weeks |
| `consent` | object | absent | always | Agreement, printed name, and a signature PNG as a data URI |

### Fields that need care

| Field | Format | Why it is like this |
|---|---|---|
| `checkin.ohip` | `^\d{10}[A-Z]{0,2}$` | Separators stripped and upper-cased on export, so `1234-567-890-ab` and `1234 567 890 AB` do not look like two patients. The two-letter version code is missing from some older cards, so it is optional — the ten digits are not. |
| `meta.id` | `^[\w-]{8,64}$` | A UUID generated on the tablet. **Idempotency key** — a retried submission carries the same id, so it must not create two encounters. |
| `patient.dob` | `YYYY-MM-DD` | ISO date, no time component. |
| `meta.submittedAt` | ISO 8601 UTC | When the patient pressed submit, not when it reached you. |
| `visit.pain` | integer 0–10 | Exported to FHIR as LOINC `72514-3`. |
| `consent.signaturePng` | `data:image/png;base64` | Around 20–30 KB. Omitted from the CSV and from the files in `samples/`, for length. |
| `visit.symptoms`, `medicalHistory.conditions`, etc. | `string[]` | Patient-facing wording, not coded terminology. If you want SNOMED or ICD, tell us the code system and the mapping goes in one file. |

---

## 5. Sample files

All generated by the shipping exporters, so they are exactly what the clinic
system produces. Regenerate at any time — see `samples/README.md`.

| File | What it is |
|---|---|
| `samples/full-registration.json` | The canonical submission. Everything else is derived from this. |
| `samples/full-registration.csv` | One row, 48 fixed columns, UTF-8 with BOM. |
| `samples/full-registration.fhir.json` | FHIR R4 collection bundle — 19 resources. |
| `samples/full-registration.txt` | The plain-text clinical note staff paste today. |
| `samples/quick-checkin.json` / `.csv` / `.txt` | The reduced returning-patient shape. |
| `samples/batch.csv` | Three submissions, one row each — the shape a bulk loader wants. |

The CSV column order is fixed and declared explicitly rather than derived from
the data, so the header never shifts between a quick check-in and a full
registration. A field a pathway did not collect comes through as an empty cell.

### The request we propose

This is **our proposal, not your specification**. Every name here is a guess we
made so there is something concrete to react to.

```http
POST https://{alembico-host}/api/v1/encounters
Authorization: Bearer {clinic-pc-credential}
Content-Type: application/json
Idempotency-Key: a7f3c891-4d02-4b16-9e58-2c7d10ab55f9

{
  "externalId": "a7f3c891-4d02-4b16-9e58-2c7d10ab55f9",
  "patientIdentifier": { "system": "ON-HCN", "value": "4821567390AB" },
  "encounterDate": "2026-08-29T14:42:19.907Z",
  "source": "CareXPS digital intake v1.0",
  "verified": false,
  "note": "<contents of full-registration.txt>",
  "attachments": [
    { "filename": "Intake_Mitchell_Sarah_2026-08-29_1042_a7f3c891.pdf",
      "contentType": "application/pdf", "encoding": "base64", "content": "..." }
  ]
}
```

Tell us the real endpoint, the real field names, and the real auth scheme, and
this becomes one file change on the clinic PC.

---

## 6. Things worth knowing before you read the data

**The health card photo is never kept.** A patient can photograph the front of
their card, but the image is discarded immediately and the number is typed by
hand. An OCR guess written into a chart as a health number is worse than no
number at all — it silently points at somebody else.

**This is patient-entered and unverified.** Nobody at the clinic has checked any
of it when it reaches you. Every export carries that statement in its footer. If
Alembico distinguishes verified from self-reported data, the whole submission
belongs in the self-reported category.

**Delivery is at-least-once.** If the PDF files successfully but the push to
Alembico fails, the submission sits in the spool and retries. The same
`meta.id` arriving twice must not produce two encounters.

**Nothing is stored longer than it needs to be.** The tablet keeps no
`localStorage`, `sessionStorage`, `IndexedDB` or cookies — state lives in memory
for one session and the page hard-reloads afterwards. Logs record a reference
and an outcome, never field values. The clinic's OneDrive folder is the system
of record until Alembico becomes one.

---

## 7. Where the code is

| Path | What it is |
|---|---|
| [`app/`](../app) | The intake form. 14 screens, no build step, retains nothing. Runs on kiosk tablets and patient phones. |
| [`app/js/exporters/`](../app/js/exporters) | The four exporters. One canonical submission in, four representations out. |
| [`desk-service/`](../desk-service) | Receives submissions, renders the PDF, files it into OneDrive. Runs on the clinic Windows PC. |
| [`desk-service/src/alembico.js`](../desk-service/src/alembico.js) | **The stub.** Currently inert. The only file that changes once you answer. |
| [`relay/`](../relay) | Azure Function for submissions from the website embed and the QR-to-phone path, which cannot reach the clinic PC. |

---

## Contact

Questions about anything above go back to the CareXPS side — we would rather
answer ten questions now than guess once.
