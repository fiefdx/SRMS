/**
 * Authentication and authorization tests. The HTTP tests need MySQL (they are skipped with a reason
 * when it is not running); the middleware tests are plain unit tests and always run.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');
const { default: config } = await import('../src/config/env.js');
const { runMigration } = await import('../src/db/migrate.js');
const { seedDatabase, closePools } = await import('../src/db/seed.js');
const { queryOne, execute, ping } = await import('../src/db/pool.js');
const { requireAdmin, requireSelfOrAdmin } = await import('../src/middleware/auth.js');

const uri = config.db.testUri;
const app = createApp();

let databaseAvailable = true;
try {
  await runMigration({ uri });
  databaseAvailable = await ping(uri);
} catch (error) {
  databaseAvailable = false;
  console.log(`Skipping authentication tests: ${error.message}`);
}

const options = databaseAvailable ? {} : { skip: `MySQL is not reachable at ${uri}` };

function runMiddleware(middleware, req, params = {}) {
  return new Promise((resolve) => {
    middleware({ ...req, params }, {}, (error) => resolve(error ?? 'next'));
  });
}

test('middleware authorization rules', async (t) => {
  await t.test('requireAdmin allows an admin, rejects a customer and an anonymous caller', async () => {
    assert.equal(await runMiddleware(requireAdmin, { user: { id: 1, role: 'admin' } }), 'next');

    const asCustomer = await runMiddleware(requireAdmin, { user: { id: 2, role: 'customer' } });
    assert.equal(asCustomer.status, 403);

    const anonymous = await runMiddleware(requireAdmin, {});
    assert.equal(anonymous.status, 401);
  });

  await t.test('requireSelfOrAdmin only lets a customer act on their own id', async () => {
    const customer = { id: 7, role: 'customer' };
    assert.equal(await runMiddleware(requireSelfOrAdmin(), { user: customer }, { userId: '7' }), 'next');
    assert.equal((await runMiddleware(requireSelfOrAdmin(), { user: customer }, { userId: '8' })).status, 403);
    assert.equal(await runMiddleware(requireSelfOrAdmin(), { user: { id: 1, role: 'admin' } }, { userId: '8' }), 'next');
    assert.equal((await runMiddleware(requireSelfOrAdmin(), {}, { userId: '8' })).status, 401);
  });
});

test('authentication over HTTP', options, async (t) => {
  const created = { email: `tester${Date.now()}@example.com`, password: 'secret123' };

  before(async () => {
    await seedDatabase({ uri });
  });

  await t.test('registration creates a customer, returns a token and never returns the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Person', email: 'Tester@Example.com', password: 'secret123', phone: '+1 555 0200' });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'tester@example.com', 'emails are normalised to lower case');
    assert.equal(res.body.user.role, 'customer', 'a registered account can never be an admin');
    assert.ok(typeof res.body.token === 'string' && res.body.token.split('.').length === 3, 'a JWT is returned');
    assert.equal(res.body.user.password, undefined);
    assert.equal(res.body.user.password_hash, undefined);

    created.email = res.body.user.email;
    created.id = res.body.user.id;
  });

  await t.test('the password is stored as a bcrypt hash, not in plain text', async () => {
    const row = await queryOne('SELECT password_hash FROM users WHERE email = ?', [created.email], uri);
    assert.ok(row.password_hash.startsWith('$2'), 'bcrypt hash format');
    assert.notEqual(row.password_hash, created.password);
    assert.ok(await bcrypt.compare(created.password, row.password_hash));
    assert.ok(!(await bcrypt.compare('wrong-password', row.password_hash)));
  });

  await t.test('registering the same email twice is a conflict', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Copy Cat', email: created.email, password: 'secret123' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.field, 'email');
  });

  await t.test('validation rejects a weak password, a bad email and unknown fields', async () => {
    const weak = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'abc' });
    assert.equal(weak.status, 422);
    assert.ok(weak.body.error.details.some((issue) => issue.field === 'password'));

    const badEmail = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: 'not-an-email', password: 'secret123' });
    assert.equal(badEmail.status, 422);

    const extraField = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'secret123', role: 'admin' });
    assert.equal(extraField.status, 422, 'the schema is strict, so a client cannot ask for the admin role');
  });

  await t.test('the seeded customer can sign in', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'demo@srms.dev', password: 'demo1234' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'customer');
    assert.ok(res.body.token);
  });

  await t.test('a wrong email and a wrong password give the same answer', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'demo@srms.dev', password: 'nope12345' });
    const wrongEmail = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'demo1234' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongEmail.status, 401);
    assert.equal(wrongPassword.body.error.message, wrongEmail.body.error.message);
  });

  await t.test('GET /api/auth/me restores the session from the token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@srms.dev', password: 'demo1234' });
    assert.equal(login.body.user.role, 'admin', 'the seeded administrator can sign in');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'admin@srms.dev');
    assert.equal(me.body.user.password_hash, undefined);
  });

  await t.test('protected routes reject missing, malformed and stale tokens', async () => {
    const anonymous = await request(app).get('/api/auth/me');
    assert.equal(anonymous.status, 401);

    const malformed = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    assert.equal(malformed.status, 401);

    const expired = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ');
    assert.equal(expired.status, 401);

    // A token is only useful while the account exists: deleting the account invalidates it.
    const goneEmail = `gone${Date.now()}@example.com`;
    const issued = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Temporary', email: goneEmail, password: 'secret123' });
    await execute('DELETE FROM users WHERE id = ?', [issued.body.user.id], uri);

    const afterDelete = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${issued.body.token}`);
    assert.equal(afterDelete.status, 401);
  });
});

after(async () => {
  await closePools();
});
