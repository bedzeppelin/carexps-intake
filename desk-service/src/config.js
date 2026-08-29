import fs from 'node:fs';
import path from 'node:path';
import { ROOT, fromRoot, findAppDir } from './paths.js';

export { ROOT };

const DEFAULTS = {
  port: 8443,
  bindAddress: '0.0.0.0',
  spoolDir: './spool',
  logDir: './logs',
  outputDir: '',
  tls: { pfxPath: './certs/desk-service.pfx', passphrase: '' },
  deviceTokens: [],
  alembico: { enabled: false, baseUrl: '', apiKey: '' },
  clinicName: 'CareXPS Urgent Care',
  maxBodyBytes: 8 * 1024 * 1024
};

export function loadConfig(file = path.join(ROOT, 'config.json')) {
  if (!fs.existsSync(file)) {
    throw new Error(`No config.json found at ${file}. Copy config.example.json and edit it, or run install.ps1.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = {
    ...DEFAULTS, ...raw,
    tls: { ...DEFAULTS.tls, ...(raw.tls || {}) },
    alembico: { ...DEFAULTS.alembico, ...(raw.alembico || {}) }
  };

  cfg.spoolDir = fromRoot(cfg.spoolDir);
  cfg.logDir = fromRoot(cfg.logDir);
  cfg.tls.pfxPath = fromRoot(cfg.tls.pfxPath);
  cfg.appDir = findAppDir(raw.appDir);

  // Fail loudly at startup rather than at 2pm on a Tuesday with a patient
  // waiting: if the output folder is wrong, nothing downstream can work.
  if (!cfg.outputDir) throw new Error('config.json: outputDir is required (the OneDrive-synced folder).');
  if (!fs.existsSync(cfg.outputDir)) {
    throw new Error(`config.json: outputDir does not exist: ${cfg.outputDir}`);
  }
  if (!cfg.deviceTokens.length) {
    throw new Error('config.json: no deviceTokens configured. Run install.ps1 -AddTablet to issue one.');
  }
  for (const dir of [cfg.spoolDir, cfg.logDir]) fs.mkdirSync(dir, { recursive: true });

  return cfg;
}
