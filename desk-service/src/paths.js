import path from 'node:path';
import fs from 'node:fs';

// Deliberately avoids `import.meta`: the packaged build is bundled to
// CommonJS for Node's single-executable support, where import.meta does not
// exist. Everything here works identically from source and from the .exe.
function resolveRoot() {
  // Packaged: the exe and its assets sit in the same folder.
  if (process.env.CAREXPS_PACKAGED === '1') return path.dirname(process.execPath);
  // From source: this file lives at <root>/src/paths.js
  const entry = process.argv[1];
  if (entry) return path.resolve(path.dirname(entry), '..');
  return process.cwd();
}

export const ROOT = resolveRoot();

export const fromRoot = p => (path.isAbsolute(p) ? p : path.join(ROOT, p));

// The tablet app is served from disk. Source layout puts it beside the
// service; the packaged layout puts it under the exe's folder.
export function findAppDir(configured) {
  if (configured) return fromRoot(configured);
  const candidates = [
    path.join(ROOT, '..', 'app'),
    path.join(ROOT, 'app')
  ];
  return candidates.find(dir => fs.existsSync(path.join(dir, 'index.html'))) || candidates[0];
}
