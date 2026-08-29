import { el, icon } from '../dom.js';
import { heading } from '../widgets.js';
import { CLINIC } from '../content.js';
import { buildReceipt, buildExportBar } from '../summary.js';
import { isKiosk } from '../../config.js';

// The end state serves two audiences with one screen: a calm confirmation for
// the patient, and a scannable receipt for whoever transcribes it.
//
// The staff view exists only on the kiosk. On a patient's own phone there is
// no staff member present, so surfacing a full chart summary there would put
// health information on a device the clinic does not control.
export function render({ session, app }) {
  const sub = session.submission;
  const staffAvailable = isKiosk() && !!sub;

  const bodyText = session.delivered
    ? 'Please have a seat — a member of our care team will call your name shortly.'
    : 'Please show this screen to the front desk so they can complete your check-in.';

  const patientView = el('div', { class: 'done' }, [
    el('div', { class: 'done__badge', style: { color: 'var(--confirm-green)' } }, [icon('check')]),
    heading(session.delivered ? "You're all checked in" : 'Almost done'),
    el('p', { class: 'done__body', text: bodyText }),
    el('div', { class: 'done__clinic' }, [
      el('div', { class: 'done__clinic-name', text: CLINIC.name }),
      el('div', { class: 'done__clinic-addr', text: CLINIC.address })
    ])
  ]);

  const toggle = el('button', {
    type: 'button', class: 'btn-pill btn-pill--md',
    onClick: () => { session.staffView = !session.staffView; refresh(); }
  });
  const startOver = el('button', {
    type: 'button', class: 'btn-pill btn-pill--md', text: 'Start new form',
    onClick: () => app.reset()
  });

  const actions = el('div', { class: 'done__actions staff-toggle-bar' },
    staffAvailable ? [toggle, startOver] : (isKiosk() ? [startOver] : []));

  const staffView = el('div', {});
  if (staffAvailable) {
    const { bar, note } = buildExportBar(sub);
    staffView.append(buildReceipt(sub), bar, el('div', { class: 'note-box', text: note }));
  }

  const node = el('div', {}, [patientView, actions, staffView]);

  function refresh() {
    const showStaff = staffAvailable && session.staffView;
    patientView.hidden = showStaff;
    staffView.hidden = !showStaff;
    toggle.textContent = session.staffView ? 'Back to patient view' : 'Staff summary view \u2192';
  }
  refresh();

  return { node, refresh };
}
