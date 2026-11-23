/**
 * API skeleton tests (node:test + supertest). They exercise the app factory without a listening port:
 * routing, the JSON error envelope and the error middleware. The health check opens a database pool,
 * so the after hook closes it to let the process exit instead of waiting on idle MySQL sockets.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { default: config } = await import('../src/config/env.js');
const { closePools } = await import('../src/db/pool.js');

after(async () => {
  await closePools();
});

const app = createApp();

test('GET /api/health reports the service is up', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.env, 'test');
  assert.ok(typeof res.body.uptimeSeconds === 'number');
});

test('GET /api/health/db is the database readiness probe', async () => {
  const res = await request(app).get('/api/health/db');
  // 200 when MySQL answers, 503 when it does not — both are correct API behaviour.
  assert.ok([200, 503].includes(res.status), `unexpected status ${res.status}`);
  assert.ok(typeof res.body.database === 'string');
});

test('GET /api lists the endpoints the frontend will call', async () => {
  const res = await request(app).get('/api');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.endpoints));
  assert.ok(res.body.endpoints.some((line) => line.includes('/api/auth/login')));
});

test('unknown routes return a JSON 404 in the standard error shape', async () => {
  const res = await request(app).get('/api/not-a-real-route');
  assert.equal(res.status, 404);
  assert.match(res.body.error.message, /No API route for GET \/api\/not-a-real-route/);
});

test('every error response carries a stable, machine-readable code', async () => {
  const cases = [
    [request(app).get('/api/no-such-route'), 404, 'NOT_FOUND'],
    [request(app).get('/api/users/me'), 401, 'UNAUTHORIZED'],
    [request(app).post('/api/orders').send({ fulfilment: 'pickup', items: [] }), 422, 'VALIDATION_FAILED'],
    [request(app).post('/api/menu').set('Content-Type', 'application/json').send('{"name": '), 400, 'INVALID_JSON'],
    [request(app).post('/api/health').send({ blob: 'x'.repeat(200_000) }), 413, 'PAYLOAD_TOO_LARGE'],
  ];

  for (const [call, status, code] of cases) {
    const res = await call;
    assert.equal(res.status, status);
    assert.equal(res.body.error.code, code, `${status} should report ${code}: ${JSON.stringify(res.body.error)}`);
    assert.ok(res.body.error.message, 'the human-readable message is always present');
  }
});

test('malformed JSON is a 400 instead of a 500', async () => {
  const res = await request(app)
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send('{"menu": ');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Request body is not valid JSON.');
});

test('oversized payloads are rejected', async () => {
  const res = await request(app).post('/api/health').send({ blob: 'x'.repeat(200_000) });
  assert.equal(res.status, 413);
});

test('CORS is limited to the configured frontend origin', async () => {
  const allowed = await request(app).get('/api/health').set('Origin', config.corsOrigin);
  assert.equal(allowed.headers['access-control-allow-origin'], config.corsOrigin);

  const other = await request(app).get('/api/health').set('Origin', 'https://example.com');
  assert.equal(other.headers['access-control-allow-origin'], undefined);

  const noOrigin = await request(app).get('/api/health');
  assert.equal(noOrigin.status, 200);
});
