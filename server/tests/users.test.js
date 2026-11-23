/**
 * User management tests. They need MySQL (skipped with a reason when it is not running) and start from
 * the seeded dataset, so the admin/customer roles and the favourites behaviour are checked against real
 * rows.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');
const { default: config } = await import('../src/config/env.js');
const { runMigration } = await import('../src/db/migrate.js');
const { seedDatabase, closePools } = await import('../src/db/seed.js');
const { queryOne, execute, ping } = await import('../src/db/pool.js');
const { updateUser } = await import('../src/services/userService.js');

const uri = config.db.testUri;
const app = createApp();

let databaseAvailable = true;
try {
  await runMigration({ uri });
  databaseAvailable = await ping(uri);
} catch (error) {
  databaseAvailable = false;
  console.log(`Skipping user management tests: ${error.message}`);
}

const options = databaseAvailable ? {} : { skip: `MySQL is not reachable at ${uri}` };

async function signIn(email, password = 'demo1234') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Could not sign in as ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function register(name, email, password = 'secret123') {
  const res = await request(app).post('/api/auth/register').send({ name, email, password });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test('user management', options, async (t) => {
  let adminToken;
  let customerToken;
  let customerId;

  before(async () => {
    await seedDatabase({ uri });
    adminToken = await signIn('admin@srms.dev');
    customerToken = await signIn('demo@srms.dev');
    customerId = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${customerToken}`)).body.user.id;
  });

  await t.test('the account list is admin only', async () => {
    assert.equal((await request(app).get('/api/users')).status, 401);

    const asCustomer = await request(app).get('/api/users').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(asCustomer.status, 403);
    assert.match(asCustomer.body.error.message, /administrator/i);

    const asAdmin = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(asAdmin.status, 200);
    assert.equal(asAdmin.body.total, 3);
    assert.equal(asAdmin.body.users.length, 3);
    assert.equal(asAdmin.body.users[0].password_hash, undefined, 'no password hash is ever returned');
  });

  await t.test('the list can be searched, filtered and paged, and rejects bad query values', async () => {
    const admins = await request(app).get('/api/users?role=admin').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(admins.status, 200);
    assert.equal(admins.body.users.length, 1);
    assert.equal(admins.body.users[0].email, 'admin@srms.dev');

    const search = await request(app).get('/api/users?search=ana').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(search.body.users[0].email, 'ana@example.com');

    const paged = await request(app).get('/api/users?limit=2&offset=2').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(paged.body.users.length, 1);
    assert.equal(paged.body.total, 3, 'the total ignores the page size');

    const badRole = await request(app).get('/api/users?role=owner').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(badRole.status, 422);

    const badLimit = await request(app).get('/api/users?limit=0').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(badLimit.status, 422);

    const unknownParam = await request(app).get('/api/users?password=guess').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(unknownParam.status, 422, 'the query schema is strict');
  });

  await t.test('a customer can read and update their own profile', async () => {
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'demo@srms.dev');

    const updated = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ phone: '+1 555 0999', dietaryTags: ['vegan'], address: '77 Lake View Road' });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.user.phone, '+1 555 0999');
    assert.deepEqual(updated.body.user.dietaryTags, ['vegan']);

    const reread = await request(app).get('/api/users/me').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(reread.body.user.address, '77 Lake View Road', 'the change is stored');
  });

  await t.test('a customer cannot change their own role or send an empty update', async () => {
    const escalation = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ role: 'admin' });
    assert.equal(escalation.status, 422, 'the self-service schema has no role field at all');

    const empty = await request(app).patch('/api/users/me').set('Authorization', `Bearer ${customerToken}`).send({});
    assert.equal(empty.status, 422);
  });

  await t.test('changing the password requires the current one', async () => {
    const account = await register('Password Tester', `pwd${Date.now()}@example.com`);
    const auth = `Bearer ${account.token}`;

    const withoutCurrent = await request(app).patch('/api/users/me').set('Authorization', auth).send({ password: 'brandnew123' });
    assert.equal(withoutCurrent.status, 422);

    const wrongCurrent = await request(app)
      .patch('/api/users/me')
      .set('Authorization', auth)
      .send({ password: 'brandnew123', currentPassword: 'wrong12345' });
    assert.equal(wrongCurrent.status, 422);
    assert.equal(wrongCurrent.body.error.details[0].field, 'currentPassword');

    const changed = await request(app)
      .patch('/api/users/me')
      .set('Authorization', auth)
      .send({ password: 'brandnew123', currentPassword: 'secret123' });
    assert.equal(changed.status, 200);

    const oldPassword = await request(app).post('/api/auth/login').send({ email: account.user.email, password: 'secret123' });
    assert.equal(oldPassword.status, 401);

    const newPassword = await request(app).post('/api/auth/login').send({ email: account.user.email, password: 'brandnew123' });
    assert.equal(newPassword.status, 200);
  });

  await t.test('reading another account is refused, an admin may read it', async () => {
    const stranger = await register('Stranger', `stranger${Date.now()}@example.com`);

    const selfRead = await request(app).get(`/api/users/${customerId}`).set('Authorization', `Bearer ${customerToken}`);
    assert.equal(selfRead.status, 200);

    const otherRead = await request(app).get(`/api/users/${stranger.user.id}`).set('Authorization', `Bearer ${customerToken}`);
    assert.equal(otherRead.status, 403);

    const adminRead = await request(app).get(`/api/users/${stranger.user.id}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminRead.status, 200);
    assert.equal(adminRead.body.user.id, stranger.user.id);

    const missing = await request(app).get('/api/users/999999').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(missing.status, 404);

    const notANumber = await request(app).get('/api/users/not-a-number').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(notANumber.status, 422);
  });

  await t.test('an admin can change a role, and a promoted account can then sign in as admin', async () => {
    const promoted = await register('Promoted Admin', `promoted${Date.now()}@example.com`);

    const changed = await request(app)
      .patch(`/api/users/${promoted.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.role, 'admin');

    const list = await request(app).get('/api/users?role=admin').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(list.body.users.length, 2);

    const selfRole = await request(app)
      .patch(`/api/users/${promoted.user.id}`)
      .set('Authorization', `Bearer ${promoted.token}`)
      .send({ role: 'customer' });
    assert.equal(selfRole.status, 400, 'nobody can change their own role');
  });

  await t.test('the last administrator cannot be demoted', async () => {
    // Set up the precondition: exactly one administrator left in the database.
    await execute("UPDATE users SET role = 'customer' WHERE role = 'admin' AND email <> 'admin@srms.dev'", [], uri);

    const admin = await queryOne("SELECT id FROM users WHERE email = 'admin@srms.dev'", [], uri);
    await assert.rejects(
      () => updateUser(admin.id, { role: 'customer' }, { id: 12345, role: 'admin' }, uri),
      /last administrator/i,
    );
  });

  await t.test('only an admin may delete an account, and never their own', async () => {
    const doomed = await register('Doomed Account', `doomed${Date.now()}@example.com`);
    const adminId = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`)).body.user.id;

    const asCustomer = await request(app).delete(`/api/users/${doomed.user.id}`).set('Authorization', `Bearer ${customerToken}`);
    assert.equal(asCustomer.status, 403);

    const customerSelfDelete = await request(app).delete(`/api/users/${customerId}`).set('Authorization', `Bearer ${customerToken}`);
    assert.equal(customerSelfDelete.status, 403, 'customers cannot delete any account, including their own');

    const adminSelfDelete = await request(app).delete(`/api/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminSelfDelete.status, 400, 'deleting the signed-in account is refused');

    const removed = await request(app).delete(`/api/users/${doomed.user.id}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.deleted, true);

    const stillSignedIn = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${doomed.token}`);
    assert.equal(stillSignedIn.status, 401, 'the token of a deleted account stops working');
  });

  await t.test('favourites are saved as menu ids and returned as menu items', async () => {
    const menu = await queryOne('SELECT id, name FROM menu_items WHERE name = ?', ['Margherita Pizza'], uri);
    const second = await queryOne('SELECT id, name FROM menu_items WHERE name = ?', ['Tiramisu'], uri);

    const saved = await request(app)
      .put('/api/users/me/favourites')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ itemIds: [second.id, menu.id] });

    assert.equal(saved.status, 200);
    assert.deepEqual(
      saved.body.favourites.map((item) => item.name),
      [second.name, menu.name],
      'the customer order is kept',
    );
    assert.equal(typeof saved.body.favourites[0].price, 'number');
    assert.ok(Array.isArray(saved.body.favourites[0].allergens));

    const read = await request(app).get('/api/users/me/favourites').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(read.body.favourites.length, 2);

    const unknown = await request(app)
      .put('/api/users/me/favourites')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ itemIds: [999999] });
    assert.equal(unknown.status, 422);
    assert.match(unknown.body.error.message, /not on the menu/i);

    const cleared = await request(app)
      .put('/api/users/me/favourites')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ itemIds: [] });
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.body.favourites, []);
  });
});

after(async () => {
  await closePools();
});
