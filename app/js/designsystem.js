// The design system reference, reachable from the header. It is not decoration:
// anyone extending this form on-site needs the palette, the type scale and the
// component states in one place, and it ships with the app so it cannot go
// stale relative to the code.

import { el } from './dom.js';

const SWATCHES = [
  ['Action Blue', '#3757D8', ''],
  ['Navy Ink', '#182B5C', ''],
  ['Alert Red', '#D91E2B', ''],
  ['Accent Purple', '#8B2FA0', ' (rare use)'],
  ['Confirm Green', '#1E8E5A', ''],
  ['Page BG', '#F6F5F1', ''],
  ['Muted Text', '#68676B', '']
];

const SPACING = [4, 8, 12, 16, 24, 32, 40, 48];

const label = text => el('div', { class: 'overlay__label', text });

export function buildDesignSystem(onClose) {
  const swatches = SWATCHES.map(([name, hex, note]) => el('div', {}, [
    el('div', {
      class: 'swatch__chip',
      style: { background: hex, border: hex === '#F6F5F1' ? '1px solid var(--border)' : '' }
    }),
    el('div', { class: 'swatch__name', text: name }),
    el('div', { class: 'swatch__hex', text: hex + note })
  ]));

  const inputDemo = (placeholder, cls) =>
    el('input', { class: `input ${cls}`.trim(), placeholder, readonly: true, tabindex: '-1' });

  const chipDemo = (text, pressed, disabled) => {
    const b = el('button', { type: 'button', class: 'chip', text, 'aria-pressed': pressed ? 'true' : 'false', tabindex: '-1' });
    b.disabled = !!disabled;
    return b;
  };

  const progressDemo = el('div', { style: { display: 'flex', gap: '4px', maxWidth: '320px', marginBottom: '8px' } },
    [true, true, false, false].map(done =>
      el('div', { class: `progress__seg${done ? ' progress__seg--done' : ''}` })));

  return el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Design system' }, [
    el('div', { class: 'overlay__inner' }, [
      el('div', { class: 'overlay__head' }, [
        el('div', { class: 'overlay__title', text: 'Design system — CareXPS Intake' }),
        el('button', { type: 'button', class: 'overlay__close', 'aria-label': 'Close', text: '\u2715', onClick: onClose })
      ]),

      label('Color palette'),
      el('div', { class: 'swatch-grid' }, swatches),

      label('Type'),
      el('div', { class: 'type-demo' }, [
        el('div', {
          style: { fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--navy-ink)', marginBottom: '6px' },
          text: 'Figtree · headlines'
        }),
        el('div', {
          style: { fontSize: '16px', color: 'var(--body-ink)', marginBottom: '6px' },
          text: 'DM Sans · body text, 400–700 weight, 16px minimum for legibility at arm\u2019s length'
        }),
        el('div', { class: 'section-label', text: 'Section label · 800 weight, uppercase' }),
        el('div', {
          style: { fontSize: '12px', color: 'var(--muted)' },
          text: 'Both faces are self-hosted, so nothing changes if the clinic wifi drops. System fonts (Segoe UI, -apple-system, Roboto, Arial) back them up.'
        })
      ]),

      label('Spacing scale (px)'),
      el('div', { class: 'spacing-demo' }, SPACING.map(w =>
        el('div', { style: { width: w + 'px' }, title: w + 'px' }))),

      label('Buttons'),
      el('div', { class: 'overlay__row' }, [
        el('button', { type: 'button', class: 'btn-primary', text: 'Primary', tabindex: '-1' }),
        el('button', { type: 'button', class: 'btn-secondary', text: 'Secondary', tabindex: '-1' }),
        (() => { const b = el('button', { type: 'button', class: 'btn-primary', text: 'Disabled', tabindex: '-1' }); b.disabled = true; return b; })()
      ]),

      label('Inputs'),
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '14px', marginBottom: '32px' } }, [
        inputDemo('Default', ''),
        inputDemo('Error', 'input--error'),
        inputDemo('Read-only', 'input--readonly')
      ]),

      label('Checklist chips'),
      el('div', { class: 'overlay__row' }, [
        chipDemo('Selected', true, false),
        chipDemo('Unselected', false, false),
        chipDemo('Disabled', false, true)
      ]),

      label('Progress indicator'),
      progressDemo,
      el('div', { style: { fontSize: '12px', color: 'var(--muted)' },
        text: 'One segment per active step; conditional steps drop out of the count when skipped.' })
    ])
  ]);
}
