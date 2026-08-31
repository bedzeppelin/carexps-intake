import { el, icon } from '../dom.js';
import { heading } from '../widgets.js';
import { CONFIG } from '../../config.js';

// The end of a visit, for the patient and nobody else.
//
// There is deliberately nothing to operate here: no summary of what they
// entered, no export, no way back into the form. A completed intake belongs to
// the clinic at this point, and the person holding the tablet is the next
// patient as often as it is the last one. Staff read submissions in the
// console, which is where the exports live.
//
// The screen clears itself after `resetAfterMs` so the tablet is ready for
// whoever picks it up next, with the count visible so nobody is surprised by
// the page changing under them. The kiosk idle timer still covers someone who
// abandons the form part-way; this covers the ordinary, finished case.
export function render({ session, app }) {
  const delivered = session.delivered;

  const bodyText = delivered
    ? 'Please have a seat — a member of our care team will call your name shortly.'
    : 'Please show this screen to the front desk so they can complete your check-in.';

  const status = el('p', { class: 'done__reset', 'aria-live': 'polite' });

  // The only control on this screen, and it is not for the patient who just
  // finished — it is for whoever picks the tablet up next, so they do not have
  // to wait out the countdown. It clears the form; it reveals nothing.
  const startNext = el('button', {
    type: 'button',
    class: 'btn-secondary done__next',
    text: 'Start a new form',
    onClick: () => app.reset()
  });

  const node = el('div', { class: 'done' }, [
    el('div', { class: 'done__badge', style: { color: 'var(--confirm-green)' } }, [icon('check')]),
    heading(delivered ? 'Thank you — you’re all checked in' : 'Almost done'),
    el('p', { class: 'done__body', text: bodyText }),
    startNext,
    status
  ]);

  // A form that failed to send is the one case worth holding on screen: the
  // patient still has to show it to the front desk, and clearing it would
  // destroy the only remaining evidence that they filled anything in.
  const countdownMs = delivered ? CONFIG.resetAfterMs : 0;
  let timer = null;
  let tick = null;

  if (countdownMs > 0) {
    let remaining = Math.round(countdownMs / 1000);

    const paint = () => {
      status.textContent = remaining > 0
        ? `This form clears for the next patient in ${remaining} second${remaining === 1 ? '' : 's'}.`
        : 'Clearing…';
    };
    paint();

    // Announced once rather than on every tick, so a screen reader is not
    // reading a number aloud twenty times.
    status.setAttribute('aria-live', 'off');

    tick = setInterval(() => {
      remaining -= 1;
      paint();
      if (remaining <= 0) clearInterval(tick);
    }, 1000);

    timer = setTimeout(() => app.reset(), countdownMs);
  }

  return {
    node,
    cleanup() {
      if (timer) clearTimeout(timer);
      if (tick) clearInterval(tick);
    }
  };
}
