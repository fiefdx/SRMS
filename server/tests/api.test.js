/**
 * API skeleton tests (node:test + supertest). They exercise the app factory without a database or a
 * listening port: routing, the JSON error envelope and the error middleware.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { default: config } = await import('../src/config/env.js');

const app = createApp();

test('GET /api/health reports the service is up', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.env, 'test');
  assert.ok(typeof res.body.uptimeSeconds === 'number');
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
