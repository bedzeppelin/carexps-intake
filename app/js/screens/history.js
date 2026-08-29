import { el } from '../dom.js';
import { heading, lede, textField, chip } from '../widgets.js';
import { toggleChips } from './shared.js';
import { HISTORY_GROUPS, HEPATITIS_TYPES } from '../content.js';

// 43 conditions. Presented as twelve collapsible groups with a count badge so
// a patient can skip whole categories at a glance instead of reading a wall
// of checkboxes. Three common groups start open so the screen is not a row
// of closed doors.
export function render({ session }) {
  const h = session.data.history;

  const groups = HISTORY_GROUPS.map(g => {
    const chips = toggleChips(h.items, g.items, () => refresh());
    const badge = el('span', { class: 'accordion__badge' });
    const chevron = el('span', { class: 'accordion__chevron', 'aria-hidden': 'true', text: '\u25be' });
    const body = el('div', { class: 'accordion__body' }, chips.buttons);
    const bodyId = `hist-${g.name.replace(/\W+/g, '-').toLowerCase()}`;
    body.id = bodyId;

    const head = el('button', {
      type: 'button', class: 'accordion__head', 'aria-controls': bodyId,
      onClick: () => {
        session.expandedGroups[g.name] = !session.expandedGroups[g.name];
        refresh();
      }
    }, [
      el('span', { class: 'accordion__name' }, [
        el('span', { class: 'accordion__title', text: g.name }), badge
      ]),
      chevron
    ]);

    const root = el('div', { class: 'accordion' }, [head, body]);
    return { name: g.name, items: g.items, root, head, body, badge, refresh: chips.refresh };
  });

  const hepChips = toggleChips(h.hepSub, HEPATITIS_TYPES.map(t => ({ value: t, label: `Hepatitis ${t}` })));
  const hepPanel = el('div', { class: 'conditional-panel' }, [
    el('div', { class: 'field__label', text: 'Which type of hepatitis?' }),
    el('div', { class: 'chip-row' }, hepChips.buttons)
  ]);

  const cancerType = textField({
    label: 'Type of cancer', value: h.cancerType, onInput: v => { h.cancerType = v; }
  });
  const cancerPanel = el('div', { class: 'conditional-panel' }, [cancerType.root]);

  const node = el('div', {}, [
    heading('Medical history'),
    lede('Select any conditions that apply. Tap a group to expand it.'),
    el('div', { class: 'stack stack--tight' }, groups.map(g => g.root)),
    hepPanel, cancerPanel
  ]);

  function refresh() {
    for (const g of groups) {
      const open = !!session.expandedGroups[g.name];
      g.head.setAttribute('aria-expanded', open ? 'true' : 'false');
      g.body.hidden = !open;
      const count = g.items.filter(i => h.items.includes(i)).length;
      g.badge.textContent = count ? String(count) : '';
      g.badge.hidden = !count;
      g.refresh();
    }
    hepPanel.hidden = !h.items.includes('Hepatitis');
    cancerPanel.hidden = !h.items.includes('Cancer');
    hepChips.refresh();
    // Sub-answers must not outlive the condition that asked for them.
    if (hepPanel.hidden && h.hepSub.length) h.hepSub.length = 0;
    if (cancerPanel.hidden && h.cancerType) { h.cancerType = ''; cancerType.input.value = ''; }
  }
  refresh();

  return { node, refresh };
}
