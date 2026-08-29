# CareXPS Digital Intake

Replaces the paper "New Patient Intake Form" at CareXPS Urgent Care
(1030 Gordon St, Suite 102, Guelph, ON) with a tablet flow that files a PDF into
the clinic's OneDrive folder and hands staff a note they can paste into
Alembico.

Built from the Claude Design prototype `CareXPS Intake.dc.html`.

## The three pieces

| | What it is | Where it runs |
|---|---|---|
| **`app/`** | The intake form. 14 screens, no build step, retains nothing. | Kiosk tablets and patient phones |
| **`desk-service/`** | Receives submissions, renders the PDF, files it into OneDrive. Also serves the app to the tablets. | The clinic Windows PC |
| **`relay/`** | Handles submissions from the website embed and the QR path, which cannot reach the clinic PC. | Azure Functions, Canada Central |
| **`embed/`** | Paste-in snippet for the doctor's Lovable site. | The marketing site |

`app/` works on its own. `desk-service/` is what makes it real. `relay/` covers
the website path.

## Getting it running

See **[INSTALL.md](INSTALL.md)** — what to install, in what order, and what
connects to what. About 20 minutes.

**For development**, serve the app on its own:

```bash
python -m http.server 8080 --directory app
```

Then open `http://localhost:8080/?nosw=1`. The `nosw` flag skips the offline
cache, which otherwise pins whatever build you loaded first. That flag is also
the recovery path if a bad build ever gets stuck on a tablet.

## How a submission travels

```
tablet ──POST──► desk service ──► spool (fsync)
                                └► PDF ──atomic write──► OneDrive folder
                                                          └► 200 ──► tablet clears
```

The order is the point. The tablet clears the patient's answers on a `200` and
on nothing else, and the desk service returns `200` only once the PDF is
confirmed on disk. If anything fails, the spool entry survives, the tablet
offers a retry, and the next service start replays what is queued.

## Who can do what

| Actor | Can | Cannot |
|---|---|---|
| Patient at a kiosk | Fill and submit the form | Open the staff summary before submitting, reach developer tooling, or leave anything behind for the next patient |
| Any device on the clinic wifi | Load the form; ask whether the service is alive | Submit without a tablet token; see the clinic name or the backlog; read a filed PDF |
| A tablet holding a token | Submit, up to 20 forms a minute | Talk to Alembico or OneDrive — it holds no credentials for either |
| The clinic PC service | Write PDFs into one configured folder; later, post to Alembico | Be reached from outside the local subnet |
| A website visitor | Submit through the relay | Reach the clinic PC at all, or see a staff summary |

Two deliberate consequences of that table:

**The Alembico credential lives only on the clinic PC.** A tablet is a screen in
a public room; anything it holds is effectively public. The PC is the only thing
that ever authenticates to an EMR.

**A device token is not a password.** It rides in the kiosk URL, so it is worth
about as much as physical access to a kiosk-locked tablet. The control that
actually carries weight is the firewall rule limiting the service to the local
subnet. The token stops accidents and casual poking, not a determined person
already standing at your front desk.

## Things that were decided deliberately

**The tablet stores nothing.** No `localStorage`, `sessionStorage`, `IndexedDB`
or cookies anywhere in `app/`. State lives in memory for one session and the
page hard-reloads afterwards, so nothing survives to the next patient. On the
kiosk an idle timer wipes it after three minutes with a warning first.

**Scanning a health card does not fill in the number.** The design prototype
faked an OCR result with a hardcoded OHIP number. On a live tablet that would
write a fabricated health number into a patient's chart, so the photo is
discarded immediately and the patient types the number themselves.

**The Alembico credential never touches a tablet.** It lives on the clinic PC,
which is the only thing that talks to Alembico. `desk-service/src/alembico.js`
is a documented stub until the API is confirmed in writing — public listings and
Alembico's own marketing disagree about whether one exists.

**Fonts and images are self-hosted.** No external requests at runtime, so the
form renders identically if the clinic wifi drops mid-visit.

**Choosing a check-in method is a promise to finish it.** Picking "Scan health
card" and pressing Continue without taking a photo used to sail straight
through. It now requires the photo and a health number, and checks the number is
ten digits — a mistyped health number is worse than a missing one, because it
silently points at somebody else.

**There is no developer UI on the kiosk.** The design-system reference the
prototype shipped in the header now lives behind `?ds=1`. A patient tapping
"Design system" and landing in a component gallery is not a thing that should be
possible.

**Logs contain no patient information**, including in PDF filenames, which are
written to the log with the name redacted.

## Still open

- **Alembico API.** Everything downstream of "file the PDF" waits on this. When
  it is answered, `desk-service/src/alembico.js` is the only file that changes.
  What Alembico needs from us, and the four questions we need answered, are
  written up in **[docs/ALEMBICO-INTEGRATION.md](docs/ALEMBICO-INTEGRATION.md)**,
  with generated sample exports in [`docs/samples/`](docs/samples).
- **Where the app is hosted for the website path**, and whether the relay's
  email delivery is acceptable or should be switched to writing directly into
  OneDrive. That is a PHIPA question for whoever handles clinic compliance, not
  a technical one.
