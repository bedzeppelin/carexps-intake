import { el } from '../dom.js';
import { heading, lede, textField, yesNo } from '../widgets.js';
import { toggleChips, syncPressed } from './shared.js';
import { FAMILY_HISTORY } from '../content.js';

export function render({ session }) {
  const f = session.data.familyHistory;
  const chips = toggleChips(f.items, FAMILY_HISTORY);

  const other = textField({
    label: 'Anything not listed?', placeholder: 'Other (optional)',
    value: f.other, onInput: v => { f.other = v; }
  });

  const pregnancy = yesNo(
    "Any chance you're currently pregnant?", f.pregnant,
    val => { f.pregnant = val; refresh(); },
    [['yes', 'Yes'], ['no', 'No'], ['na', 'N/A']]
  );

  const weeks = textField({
    label: 'How many weeks?', type: 'number', value: f.weeks,
    inputClass: 'input--narrow', onInput: v => { f.weeks = v; }
  });
  weeks.input.min = '0';
  weeks.input.max = '45';
  const weeksPanel = el('div', { style: { marginTop: '14px' } }, [weeks.root]);

  const node = el('div', {}, [
    heading('Family history'),
    lede('Select any conditions that run in your immediate family.'),
    el('div', { class: 'chip-row', style: { marginBottom: '16px' } }, chips.buttons),
    other.root,
    el('div', { class: 'card', style: { marginTop: '24px' } }, [pregnancy.root, weeksPanel])
  ]);

  function refresh() {
    chips.refresh();
    syncPressed(pregnancy.buttons, i => pregnancy.values[i] === f.pregnant);
    weeksPanel.hidden = f.pregnant !== 'yes';
    if (weeksPanel.hidden && f.weeks) { f.weeks = ''; weeks.input.value = ''; }
  }
  refresh();

  return { node, refresh };
}
