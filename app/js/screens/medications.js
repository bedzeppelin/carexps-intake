import { el } from '../dom.js';
import { heading, lede, textField, sectionLabel } from '../widgets.js';

function medRows(list, kind) {
  return list.map((row, i) => {
    const cell = (key, label, placeholder) => {
      const f = textField({
        label: i === 0 ? label : '', placeholder,
        value: row[key], onInput: v => { row[key] = v; }
      });
      if (i > 0) f.input.setAttribute('aria-label', `${kind} ${i + 1} ${label.toLowerCase()}`);
      return f.root;
    };
    return el('div', { class: 'grid-med' }, [
      cell('name', 'Medication name', 'Medication name'),
      cell('dose', 'Dose', 'Dose'),
      cell('freq', 'Frequency', 'Frequency')
    ]);
  });
}

export function render({ session }) {
  const m = session.data.medications;

  const node = el('div', {}, [
    heading('Medications'),
    lede("List what you're currently taking, prescription or not."),
    sectionLabel('Prescription'),
    el('div', { class: 'stack stack--tight', style: { marginBottom: '20px' } },
      medRows(m.prescription, 'Prescription')),
    sectionLabel('Non-prescription'),
    el('div', { class: 'stack stack--tight' },
      medRows(m.nonPrescription, 'Non-prescription'))
  ]);

  return { node, refresh() {} };
}
