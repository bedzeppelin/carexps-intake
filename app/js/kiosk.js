// Kiosk idle handling.
//
// The threat this addresses is mundane and real: a patient walks away
// mid-form and the next person in line reads their answers. After a period of
// no interaction the tablet warns, then wipes.
//
// The wipe is a full page reload rather than a state reset. That is the only
// way to guarantee nothing survives — not the signature canvas bitmap, not a
// detached DOM node holding a value, not a closure still referencing the old
// session object.

import { el } from './dom.js';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'];

export function startKioskWatch({ idleMs, warnMs, onReset }) {
  if (!idleMs) return { stop() {}, poke() {} };

  let idleTimer = null;
  let countdownTimer = null;
  let backdrop = null;

  const clearWarning = () => {
    clearInterval(countdownTimer);
    countdownTimer = null;
    backdrop?.remove();
    backdrop = null;
  };

  function schedule() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(warn, idleMs);
  }

  function poke() {
    // While the warning is up, only an explicit button press dismisses it —
    // otherwise a bag brushing the screen would keep a stranger's data alive.
    if (backdrop) return;
    schedule();
  }

  function warn() {
    let remaining = Math.ceil(warnMs / 1000);
    const count = el('strong', { text: String(remaining) });
    const body = el('p', { class: 'modal__body' }, [
      'For your privacy, this form will clear in ', count, ' seconds.'
    ]);

    backdrop = el('div', { class: 'modal-backdrop', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Are you still there?' }, [
      el('div', { class: 'modal' }, [
        el('h2', { class: 'modal__title', text: 'Still there?' }),
        body,
        el('div', { class: 'modal__actions' }, [
          el('button', {
            type: 'button', class: 'btn-primary', text: "I'm still here",
            onClick: () => { clearWarning(); schedule(); }
          }),
          el('button', {
            type: 'button', class: 'btn-secondary', text: 'Start over',
            onClick: () => { clearWarning(); onReset(); }
          })
        ])
      ])
    ]);
    document.body.appendChild(backdrop);
    backdrop.querySelector('.btn-primary').focus();

    countdownTimer = setInterval(() => {
      remaining -= 1;
      count.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) { clearWarning(); onReset(); }
    }, 1000);
  }

  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, poke, { passive: true });
  }
  schedule();

  return {
    poke,
    stop() {
      clearTimeout(idleTimer);
      clearWarning();
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, poke);
    }
  };
}
