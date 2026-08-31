// Submission transport.
//
// The contract with the desk service is deliberately strict: the tablet only
// treats a submission as complete on a 2xx, because the PC returns that only
// after the PDF is written and confirmed on disk. Anything else keeps the
// patient's answers on screen so nothing is silently lost.

import { CONFIG } from '../config.js';

export class SubmitError extends Error {
  constructor(message, { retryable = true, status = 0 } = {}) {
    super(message);
    this.retryable = retryable;
    this.status = status;
  }
}

// Review site only. Stands in for the desk service so a form can be followed
// from the tablet through to the staff console without a clinic PC.
//
// This is the one code path in the app that writes anything persistent, and it
// is reachable only from `?mode=demo`. The kiosk and remote profiles never
// touch it, so what they promise a patient — that nothing survives the session
// — still holds. The console reads the same key.
export const DEMO_KEY = 'carexps.demo.submissions';

async function submitToBrowserStorage(payload) {
  const raw = localStorage.getItem(DEMO_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  // meta.id is the idempotency key, exactly as it is for the real service.
  if (!queue.some(s => s.meta.id === payload.meta.id)) queue.unshift(payload);
  localStorage.setItem(DEMO_KEY, JSON.stringify(queue));
  return { ok: true, id: payload.meta.id, demo: true };
}

export async function submitOnce(payload) {
  if (CONFIG.submitEndpoint === 'demo:local') return submitToBrowserStorage(payload);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.submitTimeoutMs);
  try {
    const res = await fetch(CONFIG.submitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.deviceToken ? { Authorization: `Bearer ${CONFIG.deviceToken}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });
    if (res.ok) return await res.json().catch(() => ({ ok: true }));

    // Most 4xx responses mean this submission will never succeed as-is, so
    // retrying only delays telling the patient to fetch a staff member. 429 is
    // the exception: it says "not right now", not "not ever".
    const retryable = res.status >= 500 || res.status === 429;
    const message =
      res.status === 401 ? 'This tablet is not authorised with the front desk computer.'
      : res.status === 429 ? 'The front desk computer is busy. Trying again in a moment.'
      : res.status === 413 ? 'The form was too large to send.'
      : res.status >= 500 ? 'The front desk computer could not save the form.'
      : 'The front desk computer rejected the form.';
    throw new SubmitError(message, { retryable, status: res.status });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof SubmitError) throw err;
    if (err.name === 'AbortError') throw new SubmitError('The front desk computer did not respond in time.');
    throw new SubmitError('Could not reach the front desk computer.');
  } finally {
    clearTimeout(timer);
  }
}

export async function submitWithRetry(payload, { onAttempt } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= CONFIG.submitRetries; attempt++) {
    onAttempt?.(attempt);
    try {
      return await submitOnce(payload);
    } catch (err) {
      lastError = err;
      if (!err.retryable) break;
      if (attempt < CONFIG.submitRetries) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
