import { el, icon } from '../dom.js';
import { heading, lede, tile, errorLine } from '../widgets.js';
import { errorTracker, syncPressed } from './shared.js';
import { FAMILY_DOCTOR_TILES } from '../content.js';

// The one real branch in the flow. It gets a full screen with a rule, a mark
// and a bigger headline because the answer changes four steps downstream —
// the design treats it as a decision, not another field.
export function render({ session }) {
  const tracker = errorTracker(session);

  const tiles = FAMILY_DOCTOR_TILES.map(t => tile({
    title: t.title, desc: t.desc, selected: session.data.familyDoctor === t.value,
    onSelect: () => {
      session.data.familyDoctor = t.value;
      delete session.errors.choice;
      refresh();
    }
  }).root);

  const error = errorLine('Please select an option to continue', 'field__error--center');
  tracker.add('choice', error);

  const mark = el('div', {
    style: {
      width: '56px', height: '56px', borderRadius: '50%', background: 'var(--blue-tint)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 16px', color: 'var(--action-blue)'
    }
  }, [icon('plus')]);

  const node = el('div', {}, [
    el('div', { class: 'rule-accent' }),
    mark,
    heading('Would you like to become a family doctor patient?', 'h1--decision'),
    lede('This is a one-time decision for today\u2019s visit — your answer changes a few of the questions ahead.', 'lede--center'),
    el('div', { class: 'tile-row' }, tiles),
    error
  ]);

  function refresh() {
    syncPressed(tiles, i => FAMILY_DOCTOR_TILES[i].value === session.data.familyDoctor);
    tracker.refresh();
  }
  refresh();

  return { node, refresh };
}
