import { el } from '../dom.js';
import { heading, lede, textField } from '../widgets.js';
import { toggleChips } from './shared.js';
import { SURGERIES } from '../content.js';

export function render({ session }) {
  const s = session.data.surgeries;
  const chips = toggleChips(s.items, SURGERIES);

  const other = textField({
    label: 'Anything not listed?', placeholder: 'Other surgery (optional)',
    value: s.other, onInput: v => { s.other = v; }
  });

  const node = el('div', {}, [
    heading('Past surgeries'),
    lede("Select any surgeries you've had."),
    el('div', { class: 'chip-row', style: { marginBottom: '16px' } }, chips.buttons),
    other.root
  ]);

  return { node, refresh: chips.refresh };
}
