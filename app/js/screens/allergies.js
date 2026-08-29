import { el } from '../dom.js';
import { heading, lede, textField, chip } from '../widgets.js';
import { toggleChips } from './shared.js';
import { DRUG_ALLERGIES } from '../content.js';

export function render({ session }) {
  const a = session.data.allergies;

  const pairRows = a.pairs.map((row, i) => {
    const allergen = textField({
      label: i === 0 ? 'Allergen' : '', placeholder: 'Allergen',
      value: row.allergen, onInput: v => { row.allergen = v; }
    });
    const reaction = textField({
      label: i === 0 ? 'Reaction' : '', placeholder: 'Reaction',
      value: row.reaction, onInput: v => { row.reaction = v; }
    });
    // Only the first row carries visible labels; the rest are labelled for
    // assistive tech only so the column headers are not repeated four times.
    if (i > 0) {
      allergen.input.setAttribute('aria-label', `Allergen ${i + 1}`);
      reaction.input.setAttribute('aria-label', `Reaction ${i + 1}`);
    }
    return el('div', { class: 'grid-2' }, [allergen.root, reaction.root]);
  });

  const drugs = toggleChips(a.drugs, DRUG_ALLERGIES);
  const noKnown = chip('No known drug allergies', a.noKnown, () => {
    a.noKnown = !a.noKnown;
    if (a.noKnown) a.drugs.length = 0;   // the two answers cannot both be true
    refresh();
  });

  const node = el('div', {}, [
    heading('Allergies'),
    lede("List anything you're allergic to and what happens when exposed."),
    el('div', { class: 'stack stack--tight', style: { marginBottom: '20px' } }, pairRows),
    el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' } }, [
      el('div', { class: 'section-label', style: { marginBottom: '0' }, text: 'Known drug allergies' }),
      noKnown
    ]),
    el('div', { class: 'chip-row' }, drugs.buttons)
  ]);

  function refresh() {
    noKnown.setAttribute('aria-pressed', a.noKnown ? 'true' : 'false');
    drugs.refresh();
    for (const b of drugs.buttons) b.disabled = a.noKnown;
  }
  refresh();

  return { node, refresh };
}
