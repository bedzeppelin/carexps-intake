import { el } from '../dom.js';
import { heading, lede, textareaField } from '../widgets.js';
import { errorTracker, checkinBlock, painScale } from './shared.js';

// The full-registration check-in step: how you want to identify yourself,
// and nothing else. The reason for the visit gets its own screen later.
export function render({ session }) {
  const tracker = errorTracker(session);
  const block = checkinBlock(session, tracker);

  const node = el('div', {}, [
    heading('How would you like to check in?'),
    lede('Choose one option to get started.'),
    block.root
  ]);

  return {
    node,
    refresh() { block.refresh(); tracker.refresh(); },
    firstInvalid: () => tracker.firstInvalid()
  };
}

// The returning-patient shortcut: identify, say what is wrong, rate the pain.
// Three things, one screen, then done.
export function renderQuick({ session }) {
  const tracker = errorTracker(session);
  const block = checkinBlock(session, tracker);
  const pain = painScale(session);

  const problem = textareaField({
    value: session.data.visit.problem, rows: 2, required: true,
    placeholder: 'Briefly describe the problem or injury',
    errorText: 'Please tell us the reason for your visit',
    onInput: v => { session.data.visit.problem = v; }
  });
  tracker.add('problem', problem.error, problem.input);

  const node = el('div', {}, [
    heading('Quick check-in'),
    lede("Since you've been here before, we just need two things."),
    el('div', { class: 'section-label', text: '1 · Identify yourself' }),
    block.root,
    el('div', { class: 'section-label', style: { marginTop: '24px' }, text: '2 · What brings you in today?' }),
    problem.root,
    el('div', { style: { marginTop: '16px' } }, [pain.root])
  ]);

  return {
    node,
    refresh() { block.refresh(); pain.refresh(); tracker.refresh(); },
    firstInvalid: () => tracker.firstInvalid()
  };
}
