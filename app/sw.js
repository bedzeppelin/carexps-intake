// Offline shell cache.
//
// Scope is deliberately narrow: the static shell and nothing else. Patient
// data must never enter a cache, so every non-GET request and anything under
// /api/ bypasses the service worker entirely.

const VERSION = 'carexps-intake-v3';
const SHELL = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/app.css',
  './css/print.css',
  './assets/carexps-logo.png',
  './assets/fonts/figtree-var.woff2',
  './assets/fonts/dm-sans-var.woff2',
  './js/app.js',
  './js/content.js',
  './js/state.js',
  './js/dom.js',
  './js/widgets.js',
  './js/signature.js',
  './js/summary.js',
  './js/submit.js',
  './js/kiosk.js',
  './js/designsystem.js',
  './js/embed.js',
  './js/screens/index.js',
  './js/screens/shared.js',
  './js/screens/welcome.js',
  './js/screens/checkin.js',
  './js/screens/patient.js',
  './js/screens/emergency.js',
  './js/screens/visit.js',
  './js/screens/allergies.js',
  './js/screens/familyDoctor.js',
  './js/screens/history.js',
  './js/screens/surgeries.js',
  './js/screens/medications.js',
  './js/screens/familyHistory.js',
  './js/screens/consent.js',
  './js/screens/done.js',
  './js/exporters/submission.js',
  './js/exporters/csv.js',
  './js/exporters/fhir.js',
  './js/exporters/note.js',
  './js/exporters/receipt.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  // Cache-first: on a tablet the shell never changes mid-session, and a wifi
  // hiccup must not leave a patient staring at a broken page.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(hit => hit || fetch(request))
  );
});
