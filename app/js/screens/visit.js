import { el } from '../dom.js';
import { heading, lede, textField, textareaField, selectField, chipGroup, yesNo, sectionLabel } from '../widgets.js';
import { errorTracker, painScale, syncPressed, toggleChips } from './shared.js';
import { SYMPTOM_GROUPS, FREQUENCY_OPTIONS, TREND_OPTIONS } from '../content.js';

export function render({ session }) {
  const v = session.data.visit;
  const tracker = errorTracker(session);

  const problem = textareaField({
    label: "What's the problem or injury?", value: v.problem, rows: 2, required: true,
    errorText: 'Please tell us the reason for your visit',
    onInput: val => { v.problem = val; }
  });
  tracker.add('problem', problem.error, problem.input);

  const onset = textField({
    label: 'When did it start?', placeholder: 'e.g. 2 days ago',
    value: v.onset, onInput: val => { v.onset = val; }
  });

  const pain = painScale(session);
  const work = yesNo('Work-related injury?', v.workInjury, val => { v.workInjury = val; refresh(); });
  const mva = yesNo('Motor vehicle accident?', v.mva, val => { v.mva = val; refresh(); });

  // 21 symptoms split into six labelled groups. A flat list of 21 checkboxes
  // reads as a wall; grouped chips let a patient scan for their own symptom.
  const groups = SYMPTOM_GROUPS.map(g => {
    const chips = toggleChips(v.symptoms, g.items);
    return { ...chipGroup(g.name, chips.buttons), refresh: chips.refresh };
  });

  const other = textField({
    placeholder: 'Other symptom (optional)', label: 'Anything else?',
    value: v.symptomOther, onInput: val => { v.symptomOther = val; }
  });
  const frequency = selectField({ label: 'Frequency', value: v.frequency, options: FREQUENCY_OPTIONS, onInput: val => { v.frequency = val; } });
  const trend = selectField({ label: 'Trend', value: v.trend, options: TREND_OPTIONS, onInput: val => { v.trend = val; } });

  const node = el('div', {}, [
    heading('Reason for your visit'),
    lede("Tell us what's going on today."),
    problem.root,
    el('div', { style: { marginTop: '16px' } }, [onset.root]),
    el('div', { style: { margin: '24px 0 20px' } }, [pain.root]),
    el('div', { class: 'grid-2', style: { marginBottom: '24px' } }, [work.root, mva.root]),
    sectionLabel('Symptoms — select all that apply'),
    el('div', { class: 'stack', style: { marginBottom: '16px' } }, groups.map(g => g.root)),
    other.root,
    el('div', { class: 'grid-2', style: { marginTop: '24px' } }, [frequency.root, trend.root])
  ]);

  function refresh() {
    pain.refresh();
    syncPressed(work.buttons, i => work.values[i] === v.workInjury);
    syncPressed(mva.buttons, i => mva.values[i] === v.mva);
    groups.forEach(g => g.refresh());
    tracker.refresh();
  }
  refresh();

  return { node, refresh, firstInvalid: () => tracker.firstInvalid() };
}
