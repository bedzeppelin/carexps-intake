import { el } from '../dom.js';
import { heading, lede, textField, selectField } from '../widgets.js';
import { errorTracker } from './shared.js';
import { PROVINCES, SEX_OPTIONS, MARITAL_OPTIONS } from '../content.js';

// Progressive disclosure: the rest of the form appears once a name is in.
// Toggling `hidden` on the wrappers (rather than rebuilding markup) is what
// keeps the caret where the patient left it while they type.
export function render({ session }) {
  const p = session.data.patient;
  const tracker = errorTracker(session);
  const bind = key => v => { p[key] = v; refresh(); };

  const first = textField({
    label: 'First name', value: p.first, required: true,
    errorText: 'First name is required', onInput: bind('first')
  });
  const last = textField({
    label: 'Last name', value: p.last, required: true,
    errorText: 'Last name is required', onInput: bind('last')
  });
  const dob = textField({
    label: 'Date of birth', type: 'date', value: p.dob, required: true,
    errorText: 'Date of birth is required', onInput: bind('dob')
  });
  tracker.add('first', first.error, first.input);
  tracker.add('last', last.error, last.input);
  tracker.add('dob', dob.error, dob.input);

  const address = textField({ label: 'Address', value: p.address, span: true, onInput: v => { p.address = v; } });
  const city = textField({ label: 'City', value: p.city, onInput: v => { p.city = v; } });
  const province = selectField({ label: 'Province', value: p.province, options: PROVINCES, placeholder: null, onInput: v => { p.province = v; } });
  const postal = textField({ label: 'Postal code', value: p.postal, onInput: v => { p.postal = v; } });
  const homePhone = textField({ label: 'Home phone', type: 'tel', value: p.homePhone, onInput: v => { p.homePhone = v; } });
  const cellPhone = textField({ label: 'Cell phone', type: 'tel', value: p.cellPhone, onInput: v => { p.cellPhone = v; } });
  const email = textField({ label: 'Email', type: 'email', value: p.email, span: true, onInput: v => { p.email = v; } });
  const sex = selectField({ label: 'Sex', value: p.sex, options: SEX_OPTIONS, onInput: v => { p.sex = v; } });
  const marital = selectField({ label: 'Marital status', value: p.marital, options: MARITAL_OPTIONS, onInput: v => { p.marital = v; } });

  const addressPair = el('div', { class: 'grid-2' }, [province.root, postal.root]);
  const afterName = [address.root, city.root, addressPair, homePhone.root,
                     cellPhone.root, email.root, dob.root, sex.root, marital.root];

  const hint = el('p', { class: 'hint', text: 'The rest of the form appears once your name is filled in.' });

  const node = el('div', {}, [
    heading('Your information'),
    lede('We use this to find or create your chart.'),
    el('div', { class: 'grid-auto' }, [first.root, last.root, ...afterName]),
    hint
  ]);

  function refresh() {
    const firstFilled = !!p.first.trim();
    const lastFilled = !!p.last.trim();
    last.root.hidden = !firstFilled;
    for (const node of afterName) node.hidden = !lastFilled;
    hint.hidden = lastFilled;
    tracker.refresh();
  }
  refresh();

  return { node, refresh, firstInvalid: () => tracker.firstInvalid() };
}
