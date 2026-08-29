# Cloud relay

Handles the submissions the clinic PC cannot: someone filling the form from the
doctor's website, or on their own phone after scanning the QR code. Those
devices have no route to the front-desk PC, so this is how their form reaches
the clinic.

It receives a submission, turns it into the same four exports the desk service
produces, and delivers them. Nothing is stored.

## Deploy

Azure Functions, **Canada Central** — patient information should not leave the
country without a deliberate decision to that effect.

```bash
npm install
func azure functionapp publish <your-function-app>
```

Then set the application settings listed in `local.settings.example.json`.
Never commit real values; they belong in Azure app settings.

### Entra app registration

Create an app registration in the clinic's own Microsoft 365 tenant and grant
**application** permissions with admin consent:

| Delivery mode | Permission needed |
|---|---|
| `email` | `Mail.Send` |
| `onedrive` | `Files.ReadWrite.All` |

Using the clinic's own tenant is the point: the message never passes through a
third-party mail vendor, so no outside company holds a copy of a patient's
health information.

**Scope `Mail.Send` before you go live.** As an application permission it
grants send-as rights over *every mailbox in the tenant*, not just the intake
one. Restrict it to the single mailbox with an application access policy:

```powershell
New-ApplicationAccessPolicy -AppId <client-id> `
  -PolicyScopeGroupId intake-senders@yourclinic.ca `
  -AccessRight RestrictAccess `
  -Description "CareXPS intake relay - intake mailbox only"
```

where `intake-senders@yourclinic.ca` is a mail-enabled security group
containing only the intake mailbox. Without this, a leaked client secret is a
tenant-wide email compromise rather than a single-mailbox one.

`Files.ReadWrite.All` used by `onedrive` mode is similarly tenant-wide and has
no equivalent policy. If that is unacceptable, the SharePoint route with
`Sites.Selected` can be scoped to one site — worth raising with whoever handles
clinic compliance before choosing the mode.

### Point the form at it

In `app/config.js`, set `REMOTE_OVERRIDES.submitEndpoint` to the function URL.
Until that is set, the embedded form finishes on a confirmation screen asking
the patient to show it to the front desk — it does not pretend to have
submitted anything.

## Email or OneDrive

`DELIVERY_MODE=email` sends the four files to `MAIL_RECIPIENTS`.

`DELIVERY_MODE=onedrive` writes them straight into OneDrive with the same
token, which removes the email hop entirely — no message in transit, no copy
sitting in an inbox or a Sent Items folder. If a compliance review flags the
email path, this is the one setting to change.

## What it will and will not accept

- Only origins listed in `ALLOWED_ORIGINS` may post. Anything else gets a 403,
  because this endpoint exists for the clinic's own site and not for whoever
  finds the URL.
- Submissions are shape-checked before any delivery work is attempted.
- A delivery failure returns 502. It never returns a success it cannot back up:
  the form telling a patient they are checked in when nothing was delivered is
  the one outcome worth engineering hardest against.

## Logs

Application Insights records the submission reference and the outcome. It does
not record field values. Keep it that way — a log that accumulates patient
details is a second, unprotected copy of the chart.

## Tests

```bash
npm test
```

Runs the handler against a mocked Microsoft Graph and checks the exports, the
CORS rules, the validation, token caching, and that a Graph failure surfaces as
an error rather than a false success. No Azure resources needed.
