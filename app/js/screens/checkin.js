import { el } from '../dom.js';
import { heading, lede, textareaField, sectionLabel } from '../widgets.js';
import { errorTracker, checkinBlock, appointmentBlock, identityBlock, painScale } from './shared.js';

// The full-registration check-in step: whether you are booked, and how you
// want to identify yourself. Name and date of birth come on the next screen,
// and the reason for the visit gets its own screen after that.
export function render({ session }) {
  const tracker = errorTracker(session);
  const appointment = appointmentBlock(session, tracker);
  const block = checkinBlock(session, tracker);

  const node = el('div', {}, [
    heading('How would you like to check in?'),
    lede('Two quick questions before we set up your chart.'),
    appointment.root,
    sectionLabel('Your health card'),
    block.root
  ]);

  return {
    node,
    refresh() { appointment.refresh(); block.refresh(); tracker.refresh(); },
    firstInvalid: () => tracker.firstInvalid()
  };
}

// The returning-patient shortcut: say who you are, show a card if you have
// one, say what is wrong. One screen, then done.
//
// Name and date of birth are asked here rather than assumed from a health
// card. A returning patient is allowed to arrive without their card, and
// before this screen collected a name that produced a submission identifying
// nobody — no name, no date of birth, no number, just a complaint. The card
// is now the second identifier rather than the only one.
export function renderQuick({ session }) {
  const tracker = errorTracker(session);
  const identity = identityBlock(session, tracker);
  const appointment = appointmentBlock(session, tracker);
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
    lede("Since you've been here before, we just need a few details."),

    sectionLabel('1 · Who are you?'),
    identity.root,

    el('div', { style: { marginTop: '24px' } }, [sectionLabel('2 · Your visit today')]),
    appointment.root,

    el('div', { style: { marginTop: '8px' } }, [sectionLabel('3 · Your health card')]),
    block.root,

    el('div', { style: { marginTop: '24px' } }, [sectionLabel('4 · What brings you in today?')]),
    problem.root,
    el('div', { style: { marginTop: '16px' } }, [pain.root])
  ]);

  return {
    node,
    refresh() {
      identity.refresh(); appointment.refresh(); block.refresh();
      pain.refresh(); tracker.refresh();
    },
    firstInvalid: () => tracker.firstInvalid()
  };
}
