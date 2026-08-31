import path from 'node:path';
import { renderIntakePdf } from './pdf.js';
import { writeFileAtomic } from './spool.js';
import { log, logError } from './log.js';

// The exporters are imported straight from the tablet app rather than
// duplicated here. The service already has to ship the app folder (it serves
// it to the tablets), and one implementation means the PDF, the receipt and
// the machine exports can never drift apart.
import { receiptSections } from '../../app/js/exporters/receipt.js';
import { toClinicalNote } from '../../app/js/exporters/note.js';

export class ValidationError extends Error {}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// Deliberately shallow. The tablet is authenticated and this is not a hostile
// input surface; the job here is to reject obvious corruption before we spend
// effort rendering, not to re-specify the form.
export function validateSubmission(body) {
  if (!isObj(body)) throw new ValidationError('Body must be a JSON object.');
  if (!isObj(body.meta)) throw new ValidationError('Missing meta.');
  if (typeof body.meta.id !== 'string' || !/^[\w-]{8,64}$/.test(body.meta.id)) {
    throw new ValidationError('meta.id must be a simple identifier.');
  }
  if (!body.meta.submittedAt || Number.isNaN(Date.parse(body.meta.submittedAt))) {
    throw new ValidationError('meta.submittedAt must be an ISO timestamp.');
  }
  if (!['quick', 'full'].includes(body.meta.pathway)) {
    throw new ValidationError('meta.pathway must be "quick" or "full".');
  }
  if (!isObj(body.checkin)) throw new ValidationError('Missing checkin.');
  if (!isObj(body.visit)) throw new ValidationError('Missing visit.');
  // Both pathways carry identity as of form version 1.1. A form that cannot be
  // matched to a person is not worth filing, and a tablet sending one is
  // broken rather than merely terse.
  if (!isObj(body.patient)) {
    throw new ValidationError('Submission is missing patient identity.');
  }
  if (typeof body.patient.last !== 'string' || !body.patient.last.trim()) {
    throw new ValidationError('Submission is missing a patient last name.');
  }
  return body;
}

const pad = n => String(n).padStart(2, '0');

// Sortable and collision-free: two same-named patients in the same minute
// still get distinct files thanks to the reference suffix.
export function pdfFilename(sub) {
  const d = new Date(sub.meta.submittedAt);
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const last = (sub.patient?.last || sub.consent?.printedName || 'Patient').trim().split(/\s+/).pop();
  const first = (sub.patient?.first || '').trim().split(/\s+/)[0] || '';
  const safe = s => s.normalize('NFKD').replace(/[^A-Za-z0-9]/g, '');
  const name = [safe(last), safe(first)].filter(Boolean).join('_') || 'Patient';
  return `Intake_${name}_${stamp}_${sub.meta.id.slice(0, 8)}.pdf`;
}

export function createProcessor({ config, spool, alembico }) {
  // The order here is the whole durability story:
  //   spool (fsync) -> render -> file atomically -> release -> only then 200.
  // The tablet clears the patient's answers on a 200 and nothing else, so a
  // 200 must mean the PDF is genuinely on disk.
  async function process(sub, { replay = false } = {}) {
    const id = sub.meta.id;
    const started = Date.now();

    if (!replay) await spool.hold(id, sub);
    await spool.noteAttempt(id);

    const sections = receiptSections(sub);
    const pdf = await renderIntakePdf(sub, {
      receiptSections: sections,
      clinicName: config.clinicName
    });

    const filename = pdfFilename(sub);
    const target = path.join(config.outputDir, filename);
    await writeFileAtomic(target, pdf);
    log('pdf.filed', { id, file: filename, bytes: pdf.length, ms: Date.now() - started });

    await spool.release(id);

    // Alembico is best-effort and deliberately after the file is safe: the
    // PDF landing in OneDrive is the guarantee we make to the tablet, and an
    // EMR outage must not turn into a lost intake form.
    if (alembico?.enabled) {
      alembico.send(sub, toClinicalNote(sub))
        .then(() => log('alembico.sent', { id }))
        .catch(err => logError('alembico.failed', err, { id }));
    }

    return { id, file: filename, bytes: pdf.length };
  }

  async function replayPending() {
    const pending = await spool.pending();
    if (!pending.length) return 0;
    log('spool.replay_start', { id: String(pending.length) });
    let done = 0;
    for (const entry of pending) {
      try {
        await process(entry.submission, { replay: true });
        done++;
      } catch (err) {
        logError('spool.replay_failed', err, { id: entry.id, attempt: entry.attempts });
      }
    }
    log('spool.replay_done', { id: `${done}/${pending.length}` });
    return done;
  }

  return { process, replayPending };
}
