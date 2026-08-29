# Desk service

Runs on the clinic PC. Tablets send finished intake forms here; this turns each
one into a PDF and files it into the OneDrive-synced folder, where OneDrive
picks it up like any other document.

It also **serves the intake app to the tablets**. That is deliberate: the
tablets then load the form and submit it to the same origin, which avoids CORS
entirely, avoids the browser blocking an HTTPS page from posting to a plain-HTTP
LAN address, and gives the page the secure context the camera capture on the
check-in step needs.

## Installing

Copy the whole folder to the clinic PC, open PowerShell **as administrator**
inside it, and run:

```powershell
.\install.ps1 -OutputDir "C:\Users\Clinic\OneDrive - Clinic\Patient Forms"
```

That will:

1. Check the output folder exists and is actually writable.
2. Create an HTTPS certificate covering this PC's name and LAN addresses.
3. Write `config.json` and lock it down (it holds the certificate passphrase).
4. Open the firewall on port 8443 **to the local subnet only** — not the internet.
5. Register the service to start automatically each time you sign in.
6. Print the URL to set as each tablet's home page.

If you are using the packaged `carexps-desk-service.exe`, nothing needs to be
installed first. If you are running from source, install Node.js 20+ first.

### Setting up a tablet

1. Email `certs\carexps-root.cer` to the tablet, open it, and accept the
   certificate. Without this the tablet will not trust the address.
2. Set the printed URL as the tablet's home page. It looks like:
   `https://192.168.1.50:8443/?mode=kiosk&t=<token>`
3. Turn on the tablet's kiosk lock (Guided Access on iPad, a kiosk-lock app on
   Android) so patients cannot leave the page.

The `t=` value is that tablet's token. It is not patient data, and keeping it in
the URL means the tablet never has to store it — which matters, because the
tablet is deliberately built to retain nothing between patients.

To add another tablet later:

```powershell
.\install.ps1 -AddTablet "Front desk 2"
```

## Why "at logon" and not a Windows service

OneDrive only syncs while its user is signed in. A service running under SYSTEM
before login would file PDFs that then sit unsynced until someone logs in
anyway — and it would mean storing service credentials. Starting at logon
matches what OneDrive itself needs, and keeps file ownership sane.

## What happens to a submission

The order matters, and it is the whole reason a form cannot be silently lost:

1. The submission is written to `spool\` and flushed to disk.
2. The PDF is rendered.
3. The PDF is written to a temp file in the output folder, flushed, then
   renamed into place — so a half-written PDF never appears in a synced folder.
4. The spool entry is deleted.
5. **Only now** does the tablet get a `200`.

The tablet clears the patient's answers on a `200` and nothing else. If any step
fails, the spool entry survives, the tablet shows a retry, and the next start of
the service replays whatever is still queued.

To replay by hand without starting the server:

```powershell
.\carexps-desk-service.exe --replay-only
```

## Checking on it

```
https://localhost:8443/api/health
```

Unauthenticated this only confirms the service is alive. Add a tablet token to
get the detail — whether the output folder is writable and how many submissions
are still queued:

```powershell
$t = (Get-Content config.json -Raw | ConvertFrom-Json).deviceTokens[0]
Invoke-RestMethod https://localhost:8443/api/health -Headers @{ Authorization = "Bearer $t" }
```

The split exists because the backlog and the clinic name are not things any
device on the network should be able to ask for. Anything other than `pendingSubmissions: 0` for more than a
moment means PDFs are not being filed — check `logs\`.

Logs record which submission happened and what came of it. They deliberately
contain **no patient information**: even the PDF filename is written with the
name redacted, because a log full of patient names would be a second,
unprotected copy of the chart.

## Alembico

`src/alembico.js` is a documented stub, disabled by default. Public listings say
Alembico has no public API while its own marketing claims integrations; the
project plan is explicit that this needs confirming in writing first.

When it is confirmed, that file is the only one that changes. Two things should
stay true: the credential lives here on the PC and never on a tablet, and
sending happens only after the PDF is safely filed, so an EMR outage cannot cost
the clinic a completed form.

## Building the executable

```powershell
npm install
npm run build
```

Produces `dist\` containing the exe, the tablet app, and the installer. Copy
that whole folder to the clinic PC.

Windows may warn the first time it runs: bundling rewrites Node's own signed
executable, which invalidates that signature. Choose "More info" then "Run
anyway", or sign the exe with your own certificate if you have one.
