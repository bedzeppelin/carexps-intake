// Microsoft Graph, using the clinic's own Entra app registration.
//
// Delivering through the clinic's own Microsoft 365 tenant rather than a
// third-party mail vendor means no outside company ever holds a message
// containing patient information. Credentials live in Azure app settings and
// never leave the server.

const TOKEN_SKEW_MS = 60 * 1000;
let cached = null;

export async function getToken(cfg) {
  if (cached && cached.expiresAt - TOKEN_SKEW_MS > Date.now()) return cached.token;

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`Graph token request failed (${res.status})`);

  const json = await res.json();
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export async function sendMail(cfg, { subject, body, attachments, recipients }) {
  const token = await getToken(cfg);
  const message = {
    subject,
    body: { contentType: 'Text', content: body },
    toRecipients: recipients.map(address => ({ emailAddress: { address } })),
    attachments: attachments.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.contentType,
      contentBytes: Buffer.from(a.content).toString('base64')
    }))
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.sender)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true })
    }
  );
  if (!res.ok) throw new Error(`Graph sendMail failed (${res.status}): ${await res.text()}`);
}

// The stronger delivery option: the same token can put the files straight into
// OneDrive, which removes the email hop and everywhere it might be cached.
export async function uploadToOneDrive(cfg, { folder, files }) {
  const token = await getToken(cfg);
  for (const file of files) {
    const p = `${folder}/${file.name}`.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.oneDriveUser)}/drive/root:/${p}:/content`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.contentType },
        body: file.content
      }
    );
    if (!res.ok) throw new Error(`OneDrive upload failed for ${file.name} (${res.status})`);
  }
}
