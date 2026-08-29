// Builds the desk service into a single Windows executable, so the clinic PC
// needs nothing installed first.
//
//   npm run build   ->   dist/carexps-desk-service.exe  (+ assets and app)
//
// Node's single-executable support only takes a CommonJS entry point, which
// is why the service avoids `import.meta` (see src/paths.js) and is bundled
// to CJS here. pdfkit's standard font metrics are plain JS modules in 0.20,
// so they inline into the bundle with everything else.

import { build } from 'esbuild';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const EXE = path.join(DIST, 'carexps-desk-service.exe');
const BUNDLE = path.join(DIST, 'service.cjs');
const BLOB = path.join(DIST, 'sea-prep.blob');
const SEA_CONFIG = path.join(DIST, 'sea-config.json');

const step = msg => console.log('==> ' + msg);

// pdfkit reaches its built-in font metrics through a renamed `require$1`,
// which esbuild cannot follow, so the fonts would be left as runtime requires
// that do not exist inside a single executable. Rewriting them to ordinary
// requires of the package's own public subpaths lets esbuild inline them.
const pdfkitStandardFonts = {
  name: 'pdfkit-standard-fonts',
  setup(build) {
    // Matched on the filename alone so the path separator cannot matter.
    build.onLoad({ filter: /pdfkit\.(node\.mjs|js)$/ }, async args => {
      const source = await fsp.readFile(args.path, 'utf8');
      const contents = source.split("require$1('#standard-fonts/").join("require('pdfkit/standard-fonts/");
      const rewritten = source.split("require$1('#standard-fonts/").length - 1;
      if (!rewritten) throw new Error('pdfkit font requires not found - has pdfkit changed shape?');
      console.log(`    rewrote ${rewritten} standard-font requires`);
      return { contents, loader: 'js' };
    });
  }
};

await fsp.rm(DIST, { recursive: true, force: true });
await fsp.mkdir(DIST, { recursive: true });

step('Bundling');
await build({
  entryPoints: [path.join(ROOT, 'src', 'server.js')],
  bundle: true,
  plugins: [pdfkitStandardFonts],
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: BUNDLE,
  legalComments: 'none',
  // pdfkit builds an ICC-profile path from `import.meta.url` when it loads.
  // CommonJS has no import.meta, so without a base URL that `new URL(...)`
  // throws before the service even starts. Pointing it at the executable
  // gives it something valid to resolve against; the profile itself is only
  // read for PDF/A output, which this service never produces.
  banner: {
    js: 'const __IMPORT_META_URL__ = require("node:url").pathToFileURL(process.execPath).href;'
  },
  define: {
    // Tells src/paths.js to resolve everything relative to the executable
    // rather than to a src/ directory that will not exist.
    'process.env.CAREXPS_PACKAGED': '"1"',
    'import.meta.url': '__IMPORT_META_URL__'
  }
});
step(`Bundle: ${(fs.statSync(BUNDLE).size / 1024 / 1024).toFixed(1)} MB`);

step('Preparing the SEA blob');
await fsp.writeFile(SEA_CONFIG, JSON.stringify({
  main: BUNDLE,
  output: BLOB,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true
}, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', SEA_CONFIG], { stdio: 'inherit' });

step('Creating the executable');
await fsp.copyFile(process.execPath, EXE);
execFileSync(process.execPath, [
  path.join(ROOT, 'node_modules', 'postject', 'dist', 'cli.js'),
  EXE, 'NODE_SEA_BLOB', BLOB,
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
], { stdio: 'inherit' });

step('Copying runtime files');
await fsp.cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
await fsp.cp(path.join(ROOT, '..', 'app'), path.join(DIST, 'app'), { recursive: true });
await fsp.copyFile(path.join(ROOT, 'config.example.json'), path.join(DIST, 'config.example.json'));
await fsp.copyFile(path.join(ROOT, 'install.ps1'), path.join(DIST, 'install.ps1'));

// The bundle and blob are build intermediates; leaving them beside the exe
// would just invite someone to run the wrong file.
await fsp.rm(BUNDLE, { force: true });
await fsp.rm(BLOB, { force: true });
await fsp.rm(SEA_CONFIG, { force: true });

step(`Done: ${EXE} (${(fs.statSync(EXE).size / 1024 / 1024).toFixed(1)} MB)`);
console.log('\nCopy the whole dist folder to the clinic PC and run install.ps1 from inside it.');
