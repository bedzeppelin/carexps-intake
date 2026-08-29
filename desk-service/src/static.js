import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

export function createStaticHandler(rootDir) {
  const root = path.resolve(rootDir);

  return async function serve(req, res, urlPath) {
    let rel = decodeURIComponent(urlPath.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';

    // Resolve first, then confirm the result is still inside the root. This
    // catches traversal attempts regardless of how they were encoded.
    const target = path.resolve(root, '.' + rel);
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return true;
    }

    let stat;
    try { stat = await fsp.stat(target); } catch { return false; }
    if (stat.isDirectory()) return false;

    const type = TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      // The tablets are long-lived kiosks; the service worker owns caching,
      // so the network layer must not pin a stale build on top of it.
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(target).pipe(res);
    return true;
  };
}
