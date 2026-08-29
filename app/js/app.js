// Boot, routing and chrome.

import { CONFIG, isKiosk } from '../config.js';
import { el, clear } from './dom.js';
import {
  createSession, activeSteps, countedSteps, stepIndex,
  nextStepId, prevStepId, validate
} from './state.js';
import { STEP_META } from './content.js';
import { SCREENS } from './screens/index.js';
import { buildSubmission } from './exporters/submission.js';
import { submitWithRetry } from './submit.js';
import { startKioskWatch } from './kiosk.js';
import { buildDesignSystem } from './designsystem.js';
import { startEmbedBridge } from './embed.js';

const dom = {};
let session = createSession();
let current = null;
let kiosk = null;

const app = {
  choosePathway(value) {
    session.data.pathway = value;
    setStep(value === 'quick' ? 'quickCheckin' : 'checkin');
  },
  reset() { location.reload(); },
  goNext, goBack
};

function setStep(id) {
  session.step = id;
  session.errors = {};
  renderScreen();
  syncChrome();
  window.scrollTo(0, 0);
  // Move focus to the new heading so a screen reader announces the step and
  // keyboard focus does not stay on the Continue button of the old screen.
  const h = dom.screen.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
}

function renderScreen() {
  current?.cleanup?.();
  clear(dom.screen);
  const factory = SCREENS[session.step];
  current = factory({ session, app });
  dom.screen.appendChild(current.node);
}

function syncChrome() {
  const isWelcome = session.step === 'welcome';
  const isDone = session.step === 'done';
  const counted = countedSteps(session);
  const countedIdx = counted.findIndex(x => x.id === session.step);
  const meta = STEP_META.find(x => x.id === session.step);

  dom.meta.hidden = isWelcome;
  dom.progress.hidden = isWelcome;
  dom.counter.textContent = countedIdx >= 0 ? `Step ${countedIdx + 1} of ${counted.length}` : '';
  dom.label.textContent = meta ? meta.label : '';

  clear(dom.progress);
  counted.forEach((step, i) => dom.progress.appendChild(
    el('div', { class: `progress__seg${i <= countedIdx ? ' progress__seg--done' : ''}` })));
  dom.progress.setAttribute('aria-label',
    countedIdx >= 0 ? `Step ${countedIdx + 1} of ${counted.length}` : 'Progress');

  dom.footer.hidden = isWelcome || isDone;
  const canBack = stepIndex(session) > 0;
  dom.back.setAttribute('aria-disabled', canBack ? 'false' : 'true');
  dom.back.tabIndex = canBack ? 0 : -1;
  dom.next.textContent =
    session.step === 'consent' ? 'Submit & finish'
    : session.step === 'quickCheckin' ? 'Finish check-in'
    : 'Continue';
}

function goBack() {
  const prev = prevStepId(session);
  if (prev) setStep(prev);
}

function goNext() {
  const errors = validate(session);
  session.errors = errors;
  if (Object.keys(errors).length) {
    current.refresh?.();
    const target = current.firstInvalid?.();
    if (target) target.focus({ preventScroll: false });
    return;
  }
  const next = nextStepId(session);
  if (!next) return;
  if (next === 'done') submitFlow();
  else setStep(next);
}

// Submitting is the one place the app talks to the outside world, so it is
// also the one place that must never lie. The patient sees "checked in" only
// after the desk service confirms the PDF is on disk.
async function submitFlow() {
  const submission = buildSubmission(session);
  session.submissionId = submission.meta.id;

  if (!CONFIG.submitEndpoint) {
    // No transport configured (remote profile before the relay is deployed,
    // or a standalone demo). Land on the summary rather than pretending.
    session.submission = submission;
    session.delivered = false;
    setStep('done');
    return;
  }

  showSubmitting();
  try {
    await submitWithRetry(submission);
    session.submission = submission;
    session.delivered = true;
    setStep('done');
  } catch (err) {
    showSubmitFailure(err, submission);
  }
}

function showSubmitting() {
  dom.footer.hidden = true;
  clear(dom.screen).appendChild(el('div', { class: 'submit-state' }, [
    el('div', { class: 'spinner', role: 'status', 'aria-label': 'Submitting' }),
    el('p', { class: 'lede', text: 'Sending your form to the front desk\u2026' })
  ]));
}

function showSubmitFailure(err, submission) {
  clear(dom.screen).appendChild(el('div', { class: 'submit-state' }, [
    el('div', { class: 'submit-error', role: 'alert' }, [
      el('h2', { class: 'submit-error__title', text: "We couldn't send your form" }),
      el('p', { class: 'lede', text: err.message }),
      el('p', {
        class: 'lede',
        text: 'Your answers are still here and nothing has been lost. Try again, or let a member of staff know.'
      }),
      el('div', { class: 'modal__actions' }, [
        el('button', {
          type: 'button', class: 'btn-primary', text: 'Try again',
          onClick: () => submitFlow()
        }),
        el('button', {
          type: 'button', class: 'btn-secondary', text: 'Back to the form',
          // session.step never advanced past the last real screen, so this
          // returns the patient where they were. Hardcoding 'consent' here
          // would strand a quick check-in on a step outside its own flow.
          onClick: () => setStep(session.step)
        })
      ])
    ])
  ]));
  // Keep the payload around so a retry does not rebuild a new id.
  session.submission = submission;
}

// The design system reference is developer documentation, not something a
// patient should ever be able to open from a kiosk. It is reachable only by
// adding `?ds=1` to the URL, which nobody does by accident.
function mountOverlay() {
  if (!new URLSearchParams(location.search).has('ds')) return;

  let overlay = null;
  const close = () => { overlay?.remove(); overlay = null; };
  overlay = buildDesignSystem(close);
  document.body.appendChild(overlay);
  overlay.querySelector('.overlay__close').focus();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function boot() {
  Object.assign(dom, {
    screen: document.getElementById('screen'),
    meta: document.getElementById('topbar-meta'),
    counter: document.getElementById('step-counter'),
    label: document.getElementById('step-label'),
    progress: document.getElementById('progress'),
    footer: document.getElementById('footer'),
    back: document.getElementById('btn-back'),
    next: document.getElementById('btn-next')
  });

  dom.back.addEventListener('click', goBack);
  dom.next.addEventListener('click', goNext);
  mountOverlay();

  if (isKiosk()) {
    kiosk = startKioskWatch({
      idleMs: CONFIG.kioskIdleMs,
      warnMs: CONFIG.kioskWarnMs,
      onReset: () => app.reset()
    });
  }

  setStep('welcome');
  startEmbedBridge();

  // `?nosw=1` skips the offline cache and tears down any existing one. This is
  // the recovery path if a bad build ever gets pinned on a tablet: open the URL
  // with that flag once and the tablet is back on live files.
  const noSw = new URLSearchParams(location.search).has('nosw');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    if (noSw) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
      if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .catch(() => { /* offline cache is a bonus, not a requirement */ });
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', boot);
