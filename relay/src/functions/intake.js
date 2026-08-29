import { app } from '@azure/functions';
import { buildFiles, buildMessage, baseName } from '../bundle.js';
import { sendMail, uploadToOneDrive } from '../graph.js';

// Off-LAN submissions land here: the website embed and the QR-to-phone path.
// A patient on their own device has no route to the clinic PC, so this is the
// only way their form reaches the front desk.
//
// Nothing is persisted. The submission is turned into files, delivered, and
// dropped. Logs carry the reference and the outcome, never field values.
//
// On what the origin check is and is not: it stops a different website from
// posting here through a visitor's browser, which is what it is for. It does
// not authenticate anyone, because an Origin header is trivially set by
// anything that is not a browser. A public form endpoint is inherently open;
// the protections that actually carry weight here are the size cap, the shape
// check, and Azure-level rate limiting. Deliberately no shared secret: it
// would have to ship in the page source of a public website, where it would
// stop nobody while implying a security property that does not exist.

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const env = key => process.env[key] || '';

function config() {
  return {
    tenantId: env('GRAPH_TENANT_ID'),
    clientId: env('GRAPH_CLIENT_ID'),
    clientSecret: env('GRAPH_CLIENT_SECRET'),
    sender: env('MAIL_SENDER'),
    recipients: env('MAIL_RECIPIENTS').split(',').map(s => s.trim()).filter(Boolean),
    deliveryMode: env('DELIVERY_MODE') || 'email',
    oneDriveUser: env('ONEDRIVE_USER') || env('MAIL_SENDER'),
    oneDriveFolder: env('ONEDRIVE_FOLDER') || 'Patient Forms',
    allowedOrigins: env('ALLOWED_ORIGINS').split(',').map(s => s.trim()).filter(Boolean)
  };
}

function corsHeaders(origin, cfg) {
  if (!origin || !cfg.allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export function validate(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';
  if (!body.meta || typeof body.meta.id !== 'string') return 'Missing meta.id.';
  if (!/^[\w-]{8,64}$/.test(body.meta.id)) return 'meta.id must be a simple identifier.';
  if (Number.isNaN(Date.parse(body.meta?.submittedAt))) return 'meta.submittedAt must be an ISO timestamp.';
  if (!['quick', 'full'].includes(body.meta.pathway)) return 'meta.pathway must be "quick" or "full".';
  if (!body.visit) return 'Missing visit.';
  return null;
}

async function handler(request, context) {
  const cfg = config();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, cfg);

  if (request.method === 'OPTIONS') return { status: 204, headers: cors };

  // An unrecognised origin is refused outright: this endpoint exists for the
  // clinic's own site, not for anyone who finds the URL.
  if (cfg.allowedOrigins.length && !cors['Access-Control-Allow-Origin']) {
    context.warn('rejected origin');
    return { status: 403, jsonBody: { error: 'Origin not allowed.' } };
  }

  // This endpoint is reachable from the open internet, so refuse anything
  // oversized before spending memory parsing it. A full submission with a
  // signature runs around 30 KB.
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) {
    return { status: 413, headers: cors, jsonBody: { error: 'Submission too large.' } };
  }

  let raw;
  try { raw = await request.text(); }
  catch { return { status: 400, headers: cors, jsonBody: { error: 'Could not read the request.' } }; }
  if (raw.length > MAX_BODY_BYTES) {
    return { status: 413, headers: cors, jsonBody: { error: 'Submission too large.' } };
  }

  let body;
  try { body = JSON.parse(raw); }
  catch { return { status: 400, headers: cors, jsonBody: { error: 'Malformed JSON.' } }; }

  const problem = validate(body);
  if (problem) {
    context.warn(`rejected submission: ${problem}`);
    return { status: 400, headers: cors, jsonBody: { error: problem } };
  }

  const ref = body.meta.id;
  try {
    const files = buildFiles(body);
    if (cfg.deliveryMode === 'onedrive') {
      await uploadToOneDrive(cfg, { folder: cfg.oneDriveFolder, files });
    } else {
      const { subject, body: text } = buildMessage(body);
      await sendMail(cfg, { subject, body: text, attachments: files, recipients: cfg.recipients });
    }
    context.log(`delivered ${ref} via ${cfg.deliveryMode}`);
    return { status: 200, headers: cors, jsonBody: { ok: true, id: ref } };
  } catch (err) {
    // Deliberately vague to the caller, specific in the log — and the log
    // never contains the submission itself.
    context.error(`delivery failed for ${ref}: ${err.message}`);
    return { status: 502, headers: cors, jsonBody: { error: 'Could not deliver the form to the clinic.' } };
  }
}

app.http('intake', {
  route: 'intake',
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler
});

export { handler, config, corsHeaders, baseName };
