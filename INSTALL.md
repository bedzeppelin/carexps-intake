# Install and connect

Roughly 20 minutes, most of it on the tablets.

## 1. Clinic PC (once)

Copy `desk-service\dist` anywhere sensible on the PC — `C:\CareXPS\` is fine.
Open PowerShell **as administrator** in that folder and run:

```powershell
.\install.ps1 -OutputDir "C:\Users\Clinic\OneDrive - Clinic\Patient Forms"
```

Point `-OutputDir` at a folder inside the PC's synced OneDrive. If it does not
exist the script creates it, and it refuses to continue if it cannot write
there.

When it finishes it prints two things. Keep them:

- **A tablet URL**, like `https://192.168.1.50:8443/?mode=kiosk&t=A1b2C3...`
- **A certificate file**, at `certs\carexps-root.cer`

Nothing else needs installing — the `.exe` carries its own runtime.

## 2. Each tablet

1. **Install the certificate.** Email `carexps-root.cer` to the tablet, open the
   attachment, and accept it. On iPad also switch it on under
   *Settings → General → About → Certificate Trust Settings*. Skip this and the
   tablet will refuse the address.
2. **Open the tablet URL** from step 1 and set it as the home page.
3. **Turn on kiosk lock** — Guided Access on iPad, a kiosk-lock app on Android —
   so patients cannot leave the form.

For a second tablet, run `.\install.ps1 -AddTablet "Front desk 2"` on the PC to
get its own URL, then restart the service.

## 3. Where everything connects

| From | To | How |
|---|---|---|
| Kiosk tablet | Clinic PC | `https://<pc-ip>:8443` over the clinic wifi |
| Clinic PC | OneDrive | Writes the PDF into the synced folder; OneDrive does the rest |
| Front-desk QR display | Patient's phone | QR points at the public URL with `?mode=remote` |
| Doctor's Lovable site | Public URL | Iframe — see [embed/README.md](embed/README.md) |
| Clinic PC | Alembico | Not connected yet. Waiting on API confirmation. |

The two front tablets must be on the **same network** as the PC. A patient's own
phone will not be, which is why the phone and website paths go through the relay
instead — see [relay/README.md](relay/README.md).

## 4. Check it works

On the PC:

```powershell
$t = (Get-Content config.json -Raw | ConvertFrom-Json).deviceTokens[0]
Invoke-RestMethod https://localhost:8443/api/health -Headers @{ Authorization = "Bearer $t" }
```

`outputDirWritable: True` and `pendingSubmissions: 0` is healthy.

Then walk one test form through a tablet end to end and confirm the PDF appears
in the OneDrive folder within a few seconds. Do this before the first real
patient, not after.

## 5. If something goes wrong

**The tablet says it cannot reach the front desk computer.** The PC is asleep,
the service is not running, or the tablet is on guest wifi instead of the clinic
network. Sign in to the PC — the service starts at logon, and OneDrive only
syncs while someone is signed in.

**The tablet warns about the certificate.** Step 2.1 was skipped or not trusted.

**A form is stuck.** Anything queued sits in `spool\` and replays next time the
service starts. Nothing is lost. `.\carexps-desk-service.exe --replay-only`
processes the queue without starting the server.

**A tablet is stuck on an old version.** Open its URL once with `&nosw=1` on the
end. That clears the offline cache and puts it back on live files.

**Windows warns the first time you run the exe.** Bundling rewrites Node's own
signed executable, which invalidates that signature. Choose *More info → Run
anyway*.

## Before the first real patient

Two things are compliance decisions, not technical ones, and want a decision
from whoever handles clinic privacy:

- Where the public copy of the form is hosted, for the website and QR paths.
- Whether the relay emailing submissions is acceptable, or whether it should
  write straight into OneDrive instead. Both go through the clinic's own
  Microsoft 365 tenant; the second removes the email hop entirely.
