// Alembico integration — intentionally inert.
//
// Public listings say Alembico has no public API; Alembico's own marketing
// claims interface-level integrations. Those conflict, and the project plan
// (section 6) is explicit that this needs confirming in writing before anything
// is promised to staff. So this ships disabled and documented rather than
// guessed at.
//
// When the API is confirmed, this file is the only one that changes. Two
// things are already true and should stay true:
//
//   1. The credential lives here, on the clinic PC. It never goes near a
//      tablet, where anyone could read it from page source.
//   2. Sending happens only after the PDF is safely filed. An EMR outage must
//      never cost the clinic a completed intake form.
//
// The encounter body is the plain-text note from exporters/note.js; the
// structured payload is the FHIR R4 bundle from exporters/fhir.js.

import { log } from './log.js';

export function createAlembico(cfg) {
  if (!cfg?.enabled) {
    return { enabled: false, async send() { /* not configured */ } };
  }

  if (!cfg.baseUrl || !cfg.apiKey) {
    log('alembico.misconfigured', { reason: 'enabled but baseUrl or apiKey missing' });
    return { enabled: false, async send() {} };
  }

  return {
    enabled: true,
    async send(submission, note) {
      // Replace with the real endpoint and payload shape once confirmed.
      const res = await fetch(new URL('/encounters', cfg.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({ externalId: submission.meta.id, note })
      });
      if (!res.ok) throw new Error(`Alembico responded ${res.status}`);
      return res.json().catch(() => ({}));
    }
  };
}
