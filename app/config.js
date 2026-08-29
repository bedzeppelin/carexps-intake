// Deployment configuration.
//
// Two profiles ship from the same code:
//
//   kiosk  — served by the desk service on the clinic LAN. Submits over the
//            local network, auto-resets between patients, and exposes the
//            staff summary.
//   remote — served from a static host: the Lovable embed and the QR-to-phone
//            path. Submits to the cloud relay. No idle reset (it is the
//            patient's own phone) and no staff summary (it is not staff).
//
// A `?mode=` query parameter overrides the default, which is what the QR code
// and the iframe src use.

const DEFAULTS = {
  mode: 'kiosk',

  // Where a completed submission is POSTed. Same-origin on the kiosk, so no
  // CORS and no mixed-content problem. Set to null to disable submission and
  // fall back to the on-screen summary only.
  submitEndpoint: '/api/submissions',

  // Issued per tablet by the desk service installer and supplied as `?t=` on
  // the kiosk's home-page URL, so it is never written to disk on the tablet
  // and never handed to a device that just browsed to the address. Not patient
  // data. The Alembico credential never appears here at all — it lives on the
  // PC, which is the only thing that talks to Alembico.
  deviceToken: '',

  // Idle handling, kiosk mode only.
  kioskIdleMs: 3 * 60 * 1000,
  kioskWarnMs: 20 * 1000,

  submitTimeoutMs: 20 * 1000,
  submitRetries: 2
};

const REMOTE_OVERRIDES = {
  submitEndpoint: null,   // set to the relay URL once it is deployed
  kioskIdleMs: 0
};

function fromQuery() {
  const params = new URLSearchParams(location.search);
  const out = {};
  const mode = params.get('mode');
  if (mode === 'kiosk' || mode === 'remote') out.mode = mode;
  // Test hook — lets the idle timer be exercised without a three minute wait.
  // Only has an effect in kiosk mode, since that is the only profile that
  // arms the timer at all.
  const idle = params.get('idle');
  if (idle && /^\d+$/.test(idle)) out.kioskIdleMs = Number(idle);

  // Per-tablet token from the kiosk URL.
  const token = params.get('t');
  if (token) out.deviceToken = token;
  return out;
}

const query = fromQuery();
const mode = query.mode || DEFAULTS.mode;

export const CONFIG = {
  ...DEFAULTS,
  ...(mode === 'remote' ? REMOTE_OVERRIDES : {}),
  ...query,
  mode
};

export const isKiosk = () => CONFIG.mode === 'kiosk';
