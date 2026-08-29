# Embedding the intake form

The form is a standalone site. On the doctor's Lovable page it is embedded in an
iframe rather than copied in, which matters for two reasons: the marketing site
can be rebuilt or redesigned without touching a form that handles health
information, and because the frame is a different origin, the parent page
cannot read anything the patient types.

## How to add it

Paste the contents of `carexps-intake-embed.html` into a custom-HTML block on
the Lovable page and change `INTAKE_URL` to wherever the form is hosted.

The snippet sizes the frame to the form. The form is tall and its height changes
at every step, so it posts its height out and the snippet resizes to match —
otherwise the footer would be clipped or there would be a large empty gap.
Only the height crosses the frame boundary; nothing about the patient does.

## Hosting requirements

The host serving the form must allow the Lovable domain to frame it:

```
Content-Security-Policy: frame-ancestors 'self' https://<the-lovable-domain>
```

and must **not** send `X-Frame-Options: DENY` or `SAMEORIGIN`, which would block
the embed outright regardless of the CSP.

## What the embedded form can and cannot do

A patient on the clinic's kiosk is on the clinic LAN and submits straight to the
front-desk PC. Someone reaching the form from the website is not: their phone or
laptop has no route to that PC, so the same submit path is simply unavailable.

Off-LAN submissions therefore go to the relay in `relay/`, which emails the
completed form to the clinic as JSON and CSV attachments. Until that relay is
deployed and its URL is set in `app/config.js`, the embedded form finishes on a
confirmation screen asking the patient to show it to the front desk — it does
not pretend to have submitted anything.

The staff summary and the export buttons never appear in the embedded form.
Those are for the kiosk, where a staff member is present; on a patient's own
device they would put a full chart summary on hardware the clinic does not
control.

## QR code path

The same URL works for the QR code on the front-desk display tablet. Point the
QR at `https://<host>/?mode=remote` and it opens on the patient's phone with the
same behaviour as the embed: no idle timeout (it is their own device, so wiping
it after three minutes would be hostile), and no staff view.
