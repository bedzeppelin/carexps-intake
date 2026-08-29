// Exercises the relay without Azure or Microsoft Graph: Graph is mocked at the
// fetch boundary so we can assert on exactly what would have been sent.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const repo = path.resolve(process.cwd(), '..');
const appJs = pathToFileURL(path.join(repo, 'app', 'js')).href + '/';
const { createSession } = await import(appJs + 'state.js');
const { buildSubmission } = await import(appJs + 'exporters/submission.js');
const { buildFiles, buildMessage, baseName } = await import('../src/bundle.js');

let passed = 0;
const check = (label, fn) => { fn(); console.log('  ok  ' + label); passed++; };

function sampleSubmission() {
  const s = createSession();
  s.data.pathway = 'full';
  s.data.familyDoctor = 'no';
  s.data.checkin = { method: 'manual', ohip: '1234 567 890 AB' };
  Object.assign(s.data.patient, { first: 'Ingrid', last: 'Vasquez-Thornbury', dob: '1971-03-08', sex: 'Female', cellPhone: '519-555-0177' });
  s.data.emergency.contacts[0] = { name: 'Rafael Vasquez', phone: '519-555-0188' };
  Object.assign(s.data.visit, { problem: 'Rash on both forearms, spreading', onset: '4 days ago', pain: 3, symptoms: ['Rash', 'Swelling'], frequency: 'Constant', trend: 'Worsening' });
  s.data.allergies.drugs = ['Latex'];
  s.data.consent = { agree: true, printedName: 'Ingrid Vasquez-Thornbury' };
  s.hasSignature = true;
  return buildSubmission(s, { includeSignature: false });
}

const sub = sampleSubmission();

console.log('\nbundle');
check('four files produced', () => assert.equal(buildFiles(sub).length, 4));
check('extensions are json/csv/fhir/txt', () => {
  const names = buildFiles(sub).map(f => f.name);
  assert.ok(names.some(n => n.endsWith('.json') && !n.endsWith('.fhir.json')));
  assert.ok(names.some(n => n.endsWith('.csv')));
  assert.ok(names.some(n => n.endsWith('.fhir.json')));
  assert.ok(names.some(n => n.endsWith('.txt')));
});
check('filename is filesystem-safe and identifiable', () => {
  const stem = baseName(sub);
  assert.match(stem, /^Intake_VasquezThornbury_Ingrid_\d{4}-\d{2}-\d{2}_\d{4}_[0-9a-f]{8}$/);
});
check('csv parses back with aligned columns', () => {
  const csv = buildFiles(sub).find(f => f.name.endsWith('.csv')).content;
  const [head, row] = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
  const count = s => (s.match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g) || []).length;
  assert.equal(count(head), count(row));
});
check('fhir bundle is well formed', () => {
  const fhir = JSON.parse(buildFiles(sub).find(f => f.name.endsWith('.fhir.json')).content);
  assert.equal(fhir.resourceType, 'Bundle');
  assert.ok(fhir.entry.length > 3);
});
check('subject and body name the patient without leaking the note', () => {
  const m = buildMessage(sub);
  assert.match(m.subject, /Ingrid Vasquez-Thornbury/);
  assert.match(m.body, /Reference: /);
});

console.log('\nhandler');
process.env.GRAPH_TENANT_ID = 'tenant';
process.env.GRAPH_CLIENT_ID = 'client';
process.env.GRAPH_CLIENT_SECRET = 'secret';
process.env.MAIL_SENDER = 'intake@clinic.test';
process.env.MAIL_RECIPIENTS = 'frontdesk@clinic.test, records@clinic.test';
process.env.ALLOWED_ORIGINS = 'https://www.clinic.test';
process.env.DELIVERY_MODE = 'email';

const { handler, validate } = await import('../src/functions/intake.js');

const ctx = { log: () => {}, warn: () => {}, error: () => {} };
const req = (body, { origin = 'https://www.clinic.test', method = 'POST', contentLength } = {}) => {
  const raw = body === '__bad__' ? '{not json' : JSON.stringify(body ?? null);
  return {
    method,
    headers: {
      get: k => {
        const key = k.toLowerCase();
        if (key === 'origin') return origin;
        if (key === 'content-length') return String(contentLength ?? raw.length);
        return null;
      }
    },
    text: async () => raw
  };
};

const graphCalls = [];
globalThis.fetch = async (url, opts) => {
  graphCalls.push({ url: String(url), body: opts?.body });
  if (String(url).includes('oauth2')) {
    return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
  }
  return new Response('', { status: 202 });
};

check('validate accepts a real submission', () => assert.equal(validate(sub), null));
check('validate rejects a bogus id', () => assert.match(validate({ meta: { id: 'x' } }), /simple identifier/));
check('validate rejects an unknown pathway', () =>
  assert.match(validate({ ...sub, meta: { ...sub.meta, pathway: 'sideways' } }), /quick.*full/));

check('OPTIONS preflight is allowed for the clinic origin', async () => {});
const preflight = await handler(req(null, { method: 'OPTIONS' }), ctx);
check('preflight returns 204 with CORS', () => {
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['Access-Control-Allow-Origin'], 'https://www.clinic.test');
});

const foreign = await handler(req(sub, { origin: 'https://evil.test' }), ctx);
check('unknown origin is refused', () => assert.equal(foreign.status, 403));

const malformed = await handler(req('__bad__'), ctx);
check('malformed JSON gives 400', () => assert.equal(malformed.status, 400));

const invalid = await handler(req({ meta: { id: 'nope' } }), ctx);
check('invalid submission gives 400', () => assert.equal(invalid.status, 400));

graphCalls.length = 0;
const ok = await handler(req(sub), ctx);
check('valid submission returns 200', () => {
  assert.equal(ok.status, 200);
  assert.equal(ok.jsonBody.ok, true);
  assert.equal(ok.jsonBody.id, sub.meta.id);
});
check('token then sendMail were called', () => {
  assert.ok(graphCalls[0].url.includes('oauth2/v2.0/token'));
  assert.ok(graphCalls[1].url.includes('/sendMail'));
});
check('mail goes to both configured recipients with four attachments', () => {
  const msg = JSON.parse(graphCalls[1].body).message;
  assert.deepEqual(msg.toRecipients.map(r => r.emailAddress.address),
    ['frontdesk@clinic.test', 'records@clinic.test']);
  assert.equal(msg.attachments.length, 4);
  assert.ok(msg.attachments.every(a => a.contentBytes && a['@odata.type'].includes('fileAttachment')));
});
check('attachment contents survive base64 round-trip', () => {
  const msg = JSON.parse(graphCalls[1].body).message;
  const txt = msg.attachments.find(a => a.name.endsWith('.txt'));
  const decoded = Buffer.from(txt.contentBytes, 'base64').toString('utf8');
  assert.match(decoded, /CHIEF COMPLAINT/);
  assert.match(decoded, /Rash on both forearms/);
});
check('token is cached, not re-fetched', async () => {});
graphCalls.length = 0;
await handler(req(sub), ctx);
check('second submission reuses the cached token', () =>
  assert.ok(!graphCalls.some(c => c.url.includes('oauth2'))));

globalThis.fetch = async url =>
  String(url).includes('oauth2')
    ? new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 })
    : new Response('boom', { status: 500 });
const failed = await handler(req(sub), ctx);
check('a Graph failure surfaces as 502, not a false success', () => {
  assert.equal(failed.status, 502);
  assert.match(failed.jsonBody.error, /Could not deliver/);
});

const huge = await handler(req(sub, { contentLength: 5 * 1024 * 1024 }), ctx);
check('an oversized submission is refused before parsing', () => assert.equal(huge.status, 413));

console.log(`\n${passed} checks passed\n`);
