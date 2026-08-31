// Pieces used by more than one screen.

import { el } from '../dom.js';
import { textField, chip, optionRow, yesNo } from '../widgets.js';
import { setField, painLabel, painColor } from '../state.js';
import { CHECKIN_OPTIONS, APPOINTMENT_OPTIONS } from '../content.js';

// Tracks which error slots belong to which validation key so a screen can
// show or hide all of them in one call after validate() runs.
export function errorTracker(session) {
  const entries = [];
  return {
    // `input` is optional; when given it also picks up the red border.
    add(key, errorNode, input) { entries.push({ key, errorNode, input }); return errorNode; },
    refresh() {
      // A field can have more than one rule against it (empty vs. malformed,
      // say). Collect per-input state first so a passing rule cannot clear the
      // highlight a failing one just set.
      const inputState = new Map();
      for (const { key, errorNode, input } of entries) {
        const bad = !!session.errors[key];
        if (errorNode) errorNode.hidden = !bad;
        if (input) inputState.set(input, (inputState.get(input) || false) || bad);
      }
      for (const [input, bad] of inputState) {
        input.classList.toggle(
          input.tagName === 'TEXTAREA' ? 'textarea--error' : 'input--error', bad);
      }
    },
    firstInvalid() {
      const hit = entries.find(e => session.errors[e.key] && e.input);
      return hit ? hit.input : null;
    }
  };
}

// Pain 0-10. Eleven round targets rather than a slider: a fingertip can set
// an exact value without the drag precision a slider demands.
export function painScale(session) {
  const value = () => session.data.visit.pain;
  const readout = el('div', { class: 'pain-value' });
  const buttons = Array.from({ length: 11 }, (_, v) =>
    el('button', {
      type: 'button', class: 'pain-btn', text: String(v),
      'aria-pressed': 'false', 'aria-label': `Pain level ${v} out of 10`,
      onClick: () => { setField(session, 'visit', 'pain', v); refresh(); }
    }));

  const root = el('div', { class: 'card card--pad' }, [
    el('div', { class: 'pain-head' }, [
      el('div', { class: 'field__label', text: 'Pain level, right now' }),
      readout
    ]),
    el('div', { class: 'pain-scale', role: 'group', 'aria-label': 'Pain level, 0 to 10' }, buttons),
    el('div', { class: 'pain-ends' }, [
      el('span', { text: '0 — no pain' }),
      el('span', { text: '10 — worst pain' })
    ])
  ]);

  function refresh() {
    const v = value();
    const color = painColor(v);
    root.style.setProperty('--pain-color', color);
    readout.textContent = painLabel(v);
    buttons.forEach((btn, i) => {
      btn.setAttribute('aria-pressed', i === v ? 'true' : 'false');
      btn.style.setProperty('--pain-color', color);
    });
  }
  refresh();
  return { root, refresh };
}

const ICON_FOR = { scan: 'card', manual: 'keypad', none: 'nocard' };

// The three check-in choices plus whichever follow-up panel the choice opens.
// Shared by the quick check-in screen and the full check-in screen.
//
// Note on scanning: taking the photo does NOT fill in the OHIP number. The
// design prototype faked an OCR result with a hardcoded number, which on a
// live tablet would write a fabricated health number into a patient chart.
// The photo is discarded immediately and the patient confirms the number.
export function checkinBlock(session, tracker) {
  const d = session.data.checkin;
  const rows = CHECKIN_OPTIONS.map(opt => {
    const row = optionRow({
      title: opt.title, desc: opt.desc, iconName: ICON_FOR[opt.id],
      selected: d.method === opt.id,
      onSelect: () => {
        d.method = opt.id;
        if (opt.id !== 'scan') session.scanState = 'idle';
        delete session.errors.method;
        // Errors belonging to the method they just left are no longer theirs.
        delete session.errors.scanPhoto;
        if (opt.id === 'none') { delete session.errors.ohip; delete session.errors.ohipFormat; }
        refresh();
      }
    });
    return { id: opt.id, ...row };
  });

  const methodError = el('div', {
    class: 'field__error field__error--block', role: 'alert', hidden: true,
    text: "Please choose how you'd like to check in"
  });
  tracker.add('method', methodError);

  const ohip = textField({
    label: 'OHIP number', placeholder: '1234 567 890 AB',
    value: d.ohip, required: true,
    errorText: 'Please enter your health card number',
    onInput: v => {
      d.ohip = v;
      // Clear as they correct it rather than making them press Continue to
      // find out whether the fix worked.
      delete session.errors.ohip;
      delete session.errors.ohipFormat;
      refresh();
    }
  });
  const ohipFormatError = el('div', {
    class: 'field__error', role: 'alert', hidden: true,
    text: 'That does not look like a 10-digit Ontario health number'
  });
  ohip.root.appendChild(ohipFormatError);
  tracker.add('ohip', ohip.error, ohip.input);
  tracker.add('ohipFormat', ohipFormatError, ohip.input);

  const scanPhotoError = el('div', {
    class: 'field__error', role: 'alert', hidden: true,
    style: { marginTop: '10px' },
    text: "Please take a photo of your card, or choose 'Enter OHIP number' instead"
  });
  tracker.add('scanPhoto', scanPhotoError);

  const fileInput = (label, capture, ghost) => el('label', {
    class: `btn-upload${ghost ? ' btn-upload--ghost' : ''}`, tabindex: '0'
  }, [
    label,
    el('input', {
      type: 'file', accept: 'image/*', capture: capture ? 'environment' : null,
      onChange: e => {
        if (!e.target.files || !e.target.files.length) return;
        e.target.value = '';        // drop the file handle straight away
        d.method = 'scan';
        session.scanState = 'captured';
        delete session.errors.scanPhoto;
        refresh();
      }
    })
  ]);

  const scanPrompt = el('div', {}, [
    el('div', { class: 'confirm-text', style: { marginBottom: '10px' } ,
      text: 'Take a photo of your card, then type the number below to confirm it' }),
    el('div', { class: 'chip-row' }, [fileInput('Open camera', true), fileInput('Upload a photo', false, true)])
  ]);

  const scanConfirm = el('div', {}, [
    el('div', { class: 'confirm-line' }, [
      el('span', { class: 'confirm-dot', 'aria-hidden': 'true', text: '\u2713' }),
      el('div', { class: 'confirm-text', text: 'Photo taken — now enter the number from your card' })
    ])
  ]);

  const scanPanel = el('div', { class: 'card card--tight' }, [scanPrompt, scanConfirm, scanPhotoError]);
  const manualPanel = el('div', { class: 'card card--tight' });

  const root = el('div', {}, [
    el('div', { class: 'stack stack--tight' }, rows.map(r => r.root)),
    methodError, scanPanel, manualPanel
  ]);

  function refresh() {
    tracker.refresh();
    for (const r of rows) {
      const on = d.method === r.id;
      r.root.setAttribute('aria-pressed', on ? 'true' : 'false');
      r.check.hidden = !on;
    }
    const scan = d.method === 'scan';
    const manual = d.method === 'manual';
    scanPanel.hidden = !scan;
    manualPanel.hidden = !manual;
    scanPrompt.hidden = session.scanState === 'captured';
    scanConfirm.hidden = session.scanState !== 'captured';
    // The OHIP field is the same control in both panels — move it rather than
    // keeping two inputs whose values could drift apart.
    if (scan && session.scanState === 'captured') scanConfirm.appendChild(ohip.root);
    else if (manual) manualPanel.appendChild(ohip.root);
    ohip.root.hidden = !(manual || (scan && session.scanState === 'captured'));
  }
  refresh();
  return { root, refresh };
}

// Re-syncs a row of toggle buttons from state. Cheap enough to call on every
// refresh, and it keeps aria-pressed as the single source of visual truth.
export function syncPressed(buttons, isOn) {
  buttons.forEach((b, i) => b.setAttribute('aria-pressed', isOn(i) ? 'true' : 'false'));
}

// Name and date of birth — the least that makes a form belong to somebody.
//
// The quick check-in screen uses this because it has no Patient Information
// step. Without it a returning patient could pick "I don't have my card" and
// submit a form carrying no name, no date of birth and no health number, which
// the clinic cannot match to a chart or even to a person.
//
// It writes to the same `patient` fields the full pathway uses, so downstream
// exports do not have to care which pathway produced them.
export function identityBlock(session, tracker) {
  const p = session.data.patient;

  const first = textField({
    label: 'First name', value: p.first, required: true,
    errorText: 'First name is required',
    onInput: v => { p.first = v; delete session.errors.first; }
  });
  const last = textField({
    label: 'Last name', value: p.last, required: true,
    errorText: 'Last name is required',
    onInput: v => { p.last = v; delete session.errors.last; }
  });
  const dob = textField({
    label: 'Date of birth', type: 'date', value: p.dob, required: true,
    errorText: 'Date of birth is required',
    onInput: v => { p.dob = v; delete session.errors.dob; }
  });

  tracker.add('first', first.error, first.input);
  tracker.add('last', last.error, last.input);
  tracker.add('dob', dob.error, dob.input);

  const root = el('div', { class: 'grid-auto' }, [first.root, last.root, dob.root]);
  return { root, refresh: () => tracker.refresh() };
}

// Booked or walk-in, with the time when they know it.
export function appointmentBlock(session, tracker) {
  const c = session.data.checkin;

  const time = textField({
    label: 'Appointment time', type: 'time', value: c.appointmentTime,
    onInput: v => { c.appointmentTime = v; }
  });

  const group = yesNo('Do you have an appointment today?', c.appointment, v => {
    c.appointment = v;
    delete session.errors.appointment;
    refresh();
  }, APPOINTMENT_OPTIONS);

  const error = el('div', {
    class: 'field__error field__error--block', role: 'alert', hidden: true,
    text: 'Please let us know whether you have an appointment'
  });
  tracker.add('appointment', error);

  const root = el('div', {}, [group.root, error, time.root]);

  function refresh() {
    syncPressed(group.buttons, i => group.values[i] === c.appointment);
    // Only worth asking for a time from someone who says they have one.
    time.root.hidden = c.appointment !== 'yes';
    tracker.refresh();
  }
  refresh();
  return { root, refresh };
}

// Builds a chip per option and keeps them in sync with a string array in state.
// An option is either a plain string (label doubles as the stored value) or
// { value, label } when the two need to differ — e.g. the hepatitis chips read
// "Hepatitis B" but store "B", so downstream exports do not end up saying
// "Hepatitis Hepatitis B".
export function toggleChips(list, options, onAfterToggle) {
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  const buttons = opts.map(({ value, label }) => chip(label, list.includes(value), () => {
    const at = list.indexOf(value);
    if (at === -1) list.push(value); else list.splice(at, 1);
    refresh();
    onAfterToggle?.(value);
  }));
  const refresh = () => syncPressed(buttons, i => list.includes(opts[i].value));
  return { buttons, refresh };
}
