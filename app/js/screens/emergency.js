import { el } from '../dom.js';
import { heading, lede, textField } from '../widgets.js';
import { errorTracker } from './shared.js';

const LABELS = ['Contact 1 — required', 'Contact 2 — optional'];

export function render({ session }) {
  const contacts = session.data.emergency.contacts;
  const tracker = errorTracker(session);

  const cards = contacts.map((c, i) => {
    const name = textField({
      label: 'Name', value: c.name, required: i === 0,
      errorText: 'A first emergency contact is required',
      onInput: v => { c.name = v; }
    });
    const phone = textField({ label: 'Phone', type: 'tel', value: c.phone, onInput: v => { c.phone = v; } });
    if (i === 0) tracker.add('contactName', name.error, name.input);
    return el('div', { class: 'card' }, [
      el('div', { class: 'section-label', text: LABELS[i] }),
      el('div', { class: 'grid-auto' }, [name.root, phone.root])
    ]);
  });

  const node = el('div', {}, [
    heading('Emergency contact'),
    lede('Who should we call if we need to reach someone for you?'),
    el('div', { class: 'stack' }, cards)
  ]);

  return { node, refresh: () => tracker.refresh(), firstInvalid: () => tracker.firstInvalid() };
}
