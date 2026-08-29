import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadConfig } from './config.js';
import { initLog, log, logError } from './log.js';
import { Spool } from './spool.js';
import { createStaticHandler } from './static.js';
import { createProcessor, validateSubmission, ValidationError } from './submissions.js';
import { createAlembico } from './alembico.js';

const config = loadConfig();
initLog(config.logDir);

const spool = new Spool(config.spoolDir);
const alembico = createAlembico(config.alembico);
const processor = createProcessor({ config, spool, alembico });
const serveStatic = createStaticHandler(config.appDir);

// Constant-time compare so a token cannot be recovered by timing the response.
function tokenValid(presented) {
  if (!presented) return false;
  const given = Buffer.from(presented);
  return config.deviceTokens.some(known => {
    const expected = Buffer.from(known);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
}

// A valid token still should not be able to fill the disk, whether through
// malice or a tablet stuck in a retry loop. Deliberately generous: a busy
// front desk will never come close.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;
const recentByAddr = new Map();

function rateLimited(addr) {
  const now = Date.now();
  const hits = (recentByAddr.get(addr) || []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recentByAddr.set(addr, hits);
  if (recentByAddr.size > 256) {
    for (const [key, times] of recentByAddr) {
      if (!times.some(t => now - t < RATE_WINDOW_MS)) recentByAddr.delete(key);
    }
  }
  return hits.length > RATE_MAX;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new ValidationError('Submission too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
};

async function handleSubmission(req, res, addr) {
  if (rateLimited(addr)) {
    log('submission.rate_limited', { addr });
    return json(res, 429, { error: 'Too many submissions from this device. Please wait a moment.' });
  }
  if (!tokenValid((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) {
    log('submission.unauthorised', { addr });
    return json(res, 401, { error: 'This tablet is not authorised.' });
  }

  let sub;
  try {
    sub = validateSubmission(JSON.parse(await readBody(req, config.maxBodyBytes)));
  } catch (err) {
    logError('submission.rejected', err, { addr });
    return json(res, 400, { error: err instanceof ValidationError ? err.message : 'Malformed submission.' });
  }

  log('submission.received', { id: sub.meta.id, addr });
  try {
    const result = await processor.process(sub);
    // Only now is it true that the form is safe on disk.
    return json(res, 200, { ok: true, ...result });
  } catch (err) {
    // The spool entry survives; a restart will replay it. Tell the tablet to
    // keep the patient's answers rather than pretending we succeeded.
    logError('submission.failed', err, { id: sub.meta.id });
    return json(res, 500, { error: 'The form could not be saved. It has been queued and will be retried.' });
  }
}

async function router(req, res) {
  const addr = req.socket.remoteAddress || '';
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Nothing on the LAN has any business framing the kiosk form.
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('X-Frame-Options', 'DENY');

  const url = req.url || '/';
  try {
    if (url.startsWith('/api/submissions')) {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      return await handleSubmission(req, res, addr);
    }
    if (url.startsWith('/api/health')) {
      // Liveness is safe to share; anything that describes the clinic or its
      // backlog is not. Detail requires the same token a tablet uses.
      if (!tokenValid((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) {
        return json(res, 200, { ok: true });
      }
      const pending = await spool.pending();
      return json(res, 200, {
        ok: true, clinic: config.clinicName,
        pendingSubmissions: pending.length,
        outputDirWritable: canWrite(config.outputDir)
      });
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await serveStatic(req, res, url)) return;
    }
    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    logError('request.failed', err, { addr });
    if (!res.headersSent) json(res, 500, { error: 'Internal error' });
  }
}

function canWrite(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}

function createServer() {
  const { pfxPath, passphrase } = config.tls;
  if (fs.existsSync(pfxPath)) {
    return https.createServer({ pfx: fs.readFileSync(pfxPath), passphrase }, router);
  }
  // Plain HTTP is only ever acceptable on a developer machine. Tablets need
  // HTTPS: the camera capture on the check-in step requires a secure context,
  // and patient data must not cross the clinic LAN in the clear.
  log('tls.missing', { reason: `No certificate at ${pfxPath}; starting HTTP. Run install.ps1 before clinic use.` });
  return http.createServer(router);
}

const replayOnly = process.argv.includes('--replay-only');

processor.replayPending()
  .catch(err => logError('spool.replay_error', err))
  .then(() => {
    if (replayOnly) { log('replay.complete'); process.exit(0); }
    const server = createServer();
    server.listen(config.port, config.bindAddress, () => {
      const scheme = server instanceof https.Server ? 'https' : 'http';
      log('server.listening', { addr: `${scheme}://${config.bindAddress}:${config.port}` });
    });
    server.on('error', err => { logError('server.error', err); process.exit(1); });

    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.on(sig, () => { log('server.stopping'); server.close(() => process.exit(0)); });
    }
  });
