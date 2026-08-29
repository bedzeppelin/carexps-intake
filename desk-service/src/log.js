import fs from 'node:fs';
import path from 'node:path';

// Logs record what happened to which submission, never what was in it.
// A log file that quietly accumulates health information is its own breach,
// so nothing from the payload is ever passed to these functions.
const SAFE_KEYS = new Set(['id', 'event', 'status', 'ms', 'file', 'bytes', 'attempt', 'reason', 'device', 'addr']);

// PDF filenames embed the patient's name so staff can find them in OneDrive.
// That is right for the file and wrong for the log, which would otherwise
// become a second, unprotected store of patient names. Redaction lives here
// rather than at the call sites so it cannot be forgotten: the timestamp and
// reference that survive are enough to locate the file on disk.
const FILENAME = /^(Intake_).*?(_\d{4}-\d{2}-\d{2}_\d{4}_[0-9a-f]{8}\.\w+)$/;
const redactFile = value => {
  const m = FILENAME.exec(String(value));
  return m ? `${m[1]}<name>${m[2]}` : String(value);
};

let stream = null;
let currentDay = null;
let logDir = null;

export function initLog(dir) {
  logDir = dir;
  fs.mkdirSync(dir, { recursive: true });
}

function dayFile() {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== currentDay) {
    stream?.end();
    currentDay = day;
    stream = fs.createWriteStream(path.join(logDir, `desk-service-${day}.log`), { flags: 'a' });
  }
  return stream;
}

export function log(event, fields = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!SAFE_KEYS.has(k)) continue;
    safe[k] = k === 'file' ? redactFile(v) : v;
  }
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...safe });
  if (logDir) dayFile().write(line + '\n');
  console.log(line);
}

export function logError(event, err, fields = {}) {
  // err.message can be anything; keep it, but never attach the payload.
  log(event, { ...fields, reason: String(err?.message || err).slice(0, 300) });
}
