const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../src/app');
const store = require('../src/data/store');

let server;
let base;

const valid = {
  name: 'Test User',
  email: 'test@example.com',
  category: 'opportunity',
  subject: 'A test request',
  description: 'This is long enough to pass validation.',
};

const call = (path, options = {}) =>
  fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
  });

before(async () => {
  server = createApp({ log: false }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => store.clear());

test('GET /api/health returns 200', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('local development frontends can call the API cross-origin', async () => {
  const res = await call('/api/health', { headers: { Origin: 'http://localhost:5500' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5500');
});

test('POST creates a request: 201, Location header, defaults status to open', async () => {
  const res = await call('/api/requests', { method: 'POST', body: valid });
  assert.equal(res.status, 201);
  const { data } = await res.json();
  assert.equal(res.headers.get('location'), `/api/requests/${data.id}`);
  assert.equal(data.status, 'open');
});

test('POST with missing and bad fields returns 400 with details per field', async () => {
  const res = await call('/api/requests', { method: 'POST', body: { name: 'A', email: 'nope', category: 'x' } });
  assert.equal(res.status, 400);
  const { error } = await res.json();
  const fields = error.details.map((d) => d.field);
  for (const f of ['name', 'email', 'category', 'subject', 'description']) assert.ok(fields.includes(f), f);
});

test('POST ignores fields clients must not set (id, createdAt)', async () => {
  const res = await call('/api/requests', { method: 'POST', body: { ...valid, id: 'x', createdAt: '2000-01-01' } });
  const { data } = await res.json();
  assert.notEqual(data.id, 'x');
  assert.notEqual(data.createdAt, '2000-01-01');
});

test('invalid JSON returns 400, non-JSON content type returns 415', async () => {
  const bad = await call('/api/requests', { method: 'POST', body: '{ nope' });
  assert.equal(bad.status, 400);
  const wrong = await call('/api/requests', { method: 'POST', body: 'hi', headers: { 'Content-Type': 'text/plain' } });
  assert.equal(wrong.status, 415);
});

test('GET list and GET one; filters work; bad filter is 400', async () => {
  const a = (await (await call('/api/requests', { method: 'POST', body: valid })).json()).data;
  await call('/api/requests', { method: 'POST', body: { ...valid, status: 'resolved' } });

  const all = await (await call('/api/requests')).json();
  assert.equal(all.count, 2);
  const open = await (await call('/api/requests?status=open')).json();
  assert.equal(open.count, 1);
  assert.equal((await call('/api/requests?status=bogus')).status, 400);

  const one = await call(`/api/requests/${a.id}`);
  assert.equal(one.status, 200);
});

test('GET unknown id is 404; malformed id is 400; unknown route is 404 JSON', async () => {
  assert.equal((await call('/api/requests/6f1c1d5e-1b6a-4c1d-9b0e-2f2a2a2a2a2a')).status, 404);
  assert.equal((await call('/api/requests/123')).status, 400);
  const res = await call('/api/nothing-here');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.status, 404);
});

test('PUT replaces all fields and requires a full body', async () => {
  const { data } = await (await call('/api/requests', { method: 'POST', body: valid })).json();
  const ok = await call(`/api/requests/${data.id}`, { method: 'PUT', body: { ...valid, subject: 'New subject', status: 'closed' } });
  assert.equal(ok.status, 200);
  const updated = (await ok.json()).data;
  assert.equal(updated.subject, 'New subject');
  assert.equal(updated.status, 'closed');
  const partial = await call(`/api/requests/${data.id}`, { method: 'PUT', body: { subject: 'Only this' } });
  assert.equal(partial.status, 400);
});

test('PATCH changes only supplied fields; empty body is 400', async () => {
  const { data } = await (await call('/api/requests', { method: 'POST', body: valid })).json();
  const res = await call(`/api/requests/${data.id}`, { method: 'PATCH', body: { status: 'in_progress' } });
  assert.equal(res.status, 200);
  const patched = (await res.json()).data;
  assert.equal(patched.status, 'in_progress');
  assert.equal(patched.subject, valid.subject);
  assert.equal((await call(`/api/requests/${data.id}`, { method: 'PATCH', body: {} })).status, 400);
  assert.equal((await call(`/api/requests/${data.id}`, { method: 'PATCH', body: { status: 'nope' } })).status, 400);
});

test('DELETE returns 204 then 404', async () => {
  const { data } = await (await call('/api/requests', { method: 'POST', body: valid })).json();
  assert.equal((await call(`/api/requests/${data.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/api/requests/${data.id}`, { method: 'DELETE' })).status, 404);
});
