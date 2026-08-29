import { el } from '../dom.js';
import { tile, heading, lede } from '../widgets.js';
import { PATHWAY_TILES } from '../content.js';

export function render({ session, app }) {
  const tiles = PATHWAY_TILES.map(t => tile({
    title: t.title, desc: t.desc, iconName: t.icon, selected: false,
    onSelect: () => app.choosePathway(t.value)
  }).root);

  const node = el('div', {}, [
    el('div', { style: { textAlign: 'center', padding: '24px 0 8px' } }, [
      el('img', {
        src: 'assets/carexps-logo.png', alt: 'CareXPS Urgent Care',
        style: { height: '52px', margin: '0 auto 32px', display: 'block' }
      }),
      heading('Welcome in.', 'h1--hero'),
      lede("Whether it's your first visit or you've been here before, let's get you checked in.", 'lede--hero')
    ]),
    el('div', { class: 'tile-row' }, tiles),
    el('p', { class: 'hint hint--center', text: 'You can always ask a staff member for help.' })
  ]);

  return { node, refresh() {} };
}
