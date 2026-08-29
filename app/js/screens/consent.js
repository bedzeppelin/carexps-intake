import { el } from '../dom.js';
import { heading, lede, textField, errorLine } from '../widgets.js';
import { errorTracker } from './shared.js';
import { createSignaturePad } from '../signature.js';
import { CONSENT_PARAGRAPHS } from '../content.js';
import { todayDisplay } from '../state.js';

export function render({ session }) {
  const c = session.data.consent;
  const tracker = errorTracker(session);

  const consentBox = el('div', { class: 'consent-scroll', tabindex: '0', role: 'region', 'aria-label': 'Consent text' },
    CONSENT_PARAGRAPHS.map(t => el('p', { text: t })));

  const agree = el('input', {
    type: 'checkbox', checked: c.agree,
    onChange: e => { c.agree = e.target.checked; if (c.agree) delete session.errors.agree; refresh(); }
  });
  const agreeRow = el('label', { class: 'checkbox-row' }, [
    agree,
    el('span', { text: 'I have read and understood the above, and I agree to proceed.' })
  ]);
  const agreeError = errorLine('Please check the box to continue');
  tracker.add('agree', agreeError);

  const printedName = textField({
    label: 'Printed name', value: c.printedName, required: true,
    errorText: 'Please print your name', onInput: v => { c.printedName = v; }
  });
  tracker.add('printedName', printedName.error, printedName.input);

  const dateField = textField({ label: 'Date', value: todayDisplay(), readonly: true, inputClass: 'input--readonly' });

  const canvas = el('canvas', { class: 'sigpad__canvas', 'aria-label': 'Signature pad' });
  const placeholder = el('div', { class: 'sigpad__placeholder', text: 'Sign here' });
  const pad = el('div', { class: 'sigpad' }, [placeholder, canvas]);
  const sigError = errorLine('A signature is required');
  tracker.add('signature', sigError);

  const clearBtn = el('button', {
    type: 'button', class: 'btn-pill btn-pill--sm sigpad__clear', text: 'Clear',
    onClick: () => {
      signature.clear();
      session.hasSignature = false;
      session.signatureDataUrl = null;
      refresh();
    }
  });

  const signature = createSignaturePad(canvas, {
    onFirstStroke: () => {
      session.hasSignature = true;
      delete session.errors.signature;
      refresh();
    }
  });
  // The app reads the signature back out of here when it builds the payload.
  session.signaturePad = signature;

  const node = el('div', {}, [
    el('div', { class: 'rule-accent' }),
    heading('Consent & signature', 'h1--decision'),
    lede('Please read, then sign below.', 'lede--center'),
    consentBox,
    agreeRow, agreeError,
    el('div', { class: 'grid-2', style: { margin: '20px 0' } }, [printedName.root, dateField.root]),
    el('div', { class: 'field__label', text: 'Signature ' }),
    pad,
    el('div', { class: 'sigpad__actions' }, [sigError, clearBtn])
  ]);

  function refresh() {
    agree.checked = c.agree;
    placeholder.hidden = !signature.isEmpty();
    pad.classList.toggle('sigpad--error', !!session.errors.signature);
    tracker.refresh();
  }
  refresh();

  return {
    node, refresh,
    firstInvalid: () => tracker.firstInvalid(),
    cleanup: () => signature.destroy()
  };
}
