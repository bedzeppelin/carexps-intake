import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { log, logError } from './log.js';

// Write-then-rename. A half-written file must never appear under its final
// name — especially not in a OneDrive-synced folder, where a torn PDF would
// be replicated to every machine in the clinic before it finished uploading.
export async function writeFileAtomic(targetPath, data) {
  const dir = path.dirname(targetPath);
  const tmp = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  let handle;
  try {
    handle = await fsp.open(tmp, 'w');
    await handle.writeFile(data);
    await handle.sync();            // bytes are on the platter before the rename
  } finally {
    await handle?.close();
  }
  await fsp.rename(tmp, targetPath);

  // Directory fsync makes the rename itself durable. Windows cannot fsync a
  // directory handle at all — NTFS metadata journaling covers us there — so
  // skip it rather than opening a handle only to have sync() throw.
  if (process.platform !== 'win32') {
    let dh;
    try {
      dh = await fsp.open(dir, 'r');
      await dh.sync();
    } catch { /* not supported on this filesystem */ } finally {
      await dh?.close().catch(() => {});
    }
  }
}

export class Spool {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  file(id) { return path.join(this.dir, `${id}.json`); }

  // Called before any rendering work. Once this resolves, the submission
  // survives a crash, a power cut, or the service being restarted mid-render.
  async hold(id, submission) {
    await writeFileAtomic(this.file(id), JSON.stringify({
      id, receivedAt: new Date().toISOString(), attempts: 0, submission
    }));
    log('spool.held', { id });
  }

  async release(id) {
    try {
      await fsp.unlink(this.file(id));
      log('spool.released', { id });
    } catch (err) {
      if (err.code !== 'ENOENT') logError('spool.release_failed', err, { id });
    }
  }

  async noteAttempt(id) {
    try {
      const entry = JSON.parse(await fsp.readFile(this.file(id), 'utf8'));
      entry.attempts = (entry.attempts || 0) + 1;
      entry.lastAttemptAt = new Date().toISOString();
      await writeFileAtomic(this.file(id), JSON.stringify(entry));
      return entry.attempts;
    } catch { return 0; }
  }

  async pending() {
    const names = await fsp.readdir(this.dir).catch(() => []);
    const out = [];
    for (const name of names) {
      if (!name.endsWith('.json') || name.startsWith('.')) continue;
      try {
        out.push(JSON.parse(await fsp.readFile(path.join(this.dir, name), 'utf8')));
      } catch (err) {
        logError('spool.unreadable', err, { id: name.replace(/\.json$/, '') });
      }
    }
    return out;
  }
}
