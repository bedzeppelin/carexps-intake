// Reusable form widgets. Each builder returns { root, ... } so a screen can
// hold on to the inner nodes it needs to update later without re-querying
// the DOM or rebuilding markup.

import { el, append, icon } from './dom.js';

let uid = 0;
const nextId = prefix => `${prefix}-${++uid}`;

function labelFor(id, text, required) {
  const label = el('label', { class: 'field__label', for: id, text });
  if (required) append(label, [' ', el('span', { class: 'field__req', text: '*', 'aria-hidden': 'true' })]);
  return label;
}

// A labelled text/date/tel/email input with an error slot underneath.
// `onInput` receives the raw value; the caller owns writing it into state.
export function textField({ label, value = '', type = 'text', placeholder, onInput,
                            required = false, readonly = false, span = false,
                            inputClass = '', errorText = '' }) {
  const id = nextId('f');
  const input = el('input', {
    id, type, class: `input ${inputClass}`.trim(), value,
    placeholder: placeholder || null,
    readonly: readonly || null,
    'aria-required': required ? 'true' : null,
    onInput: onInput ? e => onInput(e.target.value) : null
  });
  const error = el('div', { class: 'field__error', role: 'alert', text: errorText, hidden: true });
  const root = el('div', { class: `field${span ? ' span-all' : ''}` },
    [labelFor(id, label, required), input, error]);
  return { root, input, error, id };
}

export function selectField({ label, value = '', options, onInput, placeholder = 'Select', span = false }) {
  const id = nextId('s');
  const select = el('select', {
    id, class: 'select',
    onInput: onInput ? e => onInput(e.target.value) : null
  });
  if (placeholder !== null) select.appendChild(el('option', { value: '', text: placeholder }));
  for (const opt of options) {
    const [val, text] = Array.isArray(opt) ? opt : [opt, opt];
    select.appendChild(el('option', { value: val, text }));
  }
  select.value = value;
  const root = el('div', { class: `field${span ? ' span-all' : ''}` }, [labelFor(id, label), select]);
  return { root, select, id };
}

export function textareaField({ label, value = '', rows = 2, placeholder, onInput, required = false, errorText = '' }) {
  const id = nextId('t');
  const input = el('textarea', {
    id, class: 'textarea', rows, placeholder: placeholder || null,
    'aria-required': required ? 'true' : null,
    onInput: onInput ? e => onInput(e.target.value) : null
  });
  input.value = value;
  const error = el('div', { class: 'field__error', role: 'alert', text: errorText, hidden: true });
  const root = el('div', { class: 'field' },
    [label ? labelFor(id, label, required) : null, input, error]);
  return { root, input, error, id };
}

// Selection chip. `aria-pressed` carries the selected state for assistive
// tech and drives the visual state in CSS — one source of truth.
export function chip(label, pressed, onToggle) {
  return el('button', {
    type: 'button', class: 'chip', 'aria-pressed': pressed ? 'true' : 'false',
    text: label, onClick: onToggle
  });
}

// A chip list wrapped in a fieldset so screen readers announce the question
// the chips belong to, rather than a bare row of buttons.
export function chipGroup(legend, chips, { legendClass = 'group-label' } = {}) {
  const row = el('div', { class: 'chip-row' }, chips);
  const root = el('fieldset', { class: 'fieldset-reset' },
    [legend ? el('legend', { class: legendClass, text: legend }) : null, row]);
  return { root, row };
}

export function yesNo(legend, value, onPick, options = [['yes', 'Yes'], ['no', 'No']]) {
  const buttons = options.map(([val, text]) =>
    chip(text, value === val, () => onPick(val)));
  const root = el('div', { class: 'field' }, [
    el('div', { class: 'field__label', id: nextId('yn'), text: legend }),
    el('div', { class: 'chip-row' }, buttons)
  ]);
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', legend);
  return { root, buttons, values: options.map(o => o[0]) };
}

export function optionRow({ title, desc, iconName, selected, onSelect }) {
  const check = el('span', { class: 'option-row__check', 'aria-hidden': 'true', text: '\u2713' });
  check.hidden = !selected;
  const root = el('button', {
    type: 'button', class: 'option-row', 'aria-pressed': selected ? 'true' : 'false',
    onClick: onSelect
  }, [
    icon(iconName, 'option-row__icon'),
    el('div', { class: 'option-row__body' }, [
      el('div', { class: 'option-row__title', text: title }),
      el('div', { class: 'option-row__desc', text: desc })
    ]),
    check
  ]);
  return { root, check };
}

export function tile({ title, desc, iconName, selected, onSelect }) {
  const root = el('button', {
    type: 'button', class: 'tile', 'aria-pressed': selected ? 'true' : 'false',
    onClick: onSelect
  }, [
    iconName ? icon(iconName, 'tile__icon') : null,
    el('div', { class: 'tile__title', text: title }),
    el('div', { class: 'tile__desc', text: desc })
  ]);
  return { root };
}

export const sectionLabel = text => el('div', { class: 'section-label', text });
export const heading = (text, variant = '') =>
  el('h1', { class: `h1 ${variant}`.trim(), text, tabindex: '-1' });
export const lede = (text, variant = '') =>
  el('p', { class: `lede ${variant}`.trim(), text });
export const errorLine = (text, variant = '') =>
  el('div', { class: `field__error ${variant}`.trim(), role: 'alert', text, hidden: true });
