/**
 * Admin reporting tests (MySQL required). They check the role gate, the arithmetic the dashboard shows,
 * and that the figures move when an order is placed — the numbers come from the database, not from a
 * hard-coded demo object.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');
const { default: config } = await import('../src/config/env.js');
const { runMigration } = await import('../src/db/migrate.js');
const { seedDatabase, closePools } = await import('../src/db/seed.js');
const { ping } = await import('../src/db/pool.js');

const uri = config.db.testUri;
const app = createApp();

let databaseAvailable = true;
try {
  await runMigration({ uri });
  databaseAvailable = await ping(uri);
} catch (error) {
  databaseAvailable = false;
  console.log(`Skipping admin tests: ${error.message}`);
}

const options = databaseAvailable ? {} : { skip: `MySQL is not reachable at ${uri}` };

test('admin reporting', options, async (t) => {
  let adminToken;
  let customerToken;
  let menuId;

  before(async () => {
    await seedDatabase({ uri });
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@srms.dev', password: 'demo1234' })).body.token;
    customerToken = (await request(app).post('/api/auth/login').send({ email: 'demo@srms.dev', password: 'demo1234' })).body.token;
    menuId = (await request(app).get('/api/menu?search=Margherita')).body.items[0].id;
  });

  await t.test('the reports are admin only', async () => {
    for (const path of ['/api/admin/stats', '/api/admin/feedback', '/api/admin/stats/revenue']) {
      assert.equal((await request(app).get(path)).status, 401, `${path} needs a session`);

      const asCustomer = await request(app).get(path).set('Authorization', `Bearer ${customerToken}`);
      assert.equal(asCustomer.status, 403, `${path} is not for customers`);
      assert.equal(asCustomer.body.error.message, 'Administrator access is required for this action');
    }
  });

  await t.test('the dashboard reports the seeded trading figures', async () => {
    const res = await request(app).get('/api/admin/stats?days=7').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);

    assert.equal(res.body.orders.total, 6);
    assert.ok(res.body.orders.revenue > 0);
    assert.ok(res.body.orders.averageOrder > 0);
    assert.equal(res.body.orders.awaitingKitchen, 1, 'one seeded order is still pending');

    assert.equal(res.body.revenueSeries.length, 7, 'one point per day for the chart');
    assert.ok(res.body.revenueSeries.every((day) => typeof day.revenue === 'number' && typeof day.orders === 'number'));

    assert.equal(res.body.popularItems[0].name, 'Margherita Pizza');
    assert.equal(res.body.popularItems[0].quantity, 3, 'cancelled orders do not make a dish popular');

    const statusTotal = res.body.statusBreakdown.reduce((sum, row) => sum + row.orders, 0);
    assert.equal(statusTotal, res.body.orders.total);

    const revenueFromStatuses = res.body.statusBreakdown
      .filter((row) => row.status !== 'cancelled')
      .reduce((sum, row) => sum + row.revenue, 0);
    assert.equal(Number(revenueFromStatuses.toFixed(2)), res.body.orders.revenue, 'the breakdown adds up to the headline');

    assert.equal(res.body.reservations.total, 4);
    assert.equal(res.body.reservations.byType.find((row) => row.type === 'birthday').bookings, 1);
    assert.equal(res.body.feedback.reviews, 3);
    assert.equal(res.body.feedback.averageRating, 3.67);
    assert.deepEqual(res.body.feedback.bySentiment, [{ sentiment: 'not analysed', reviews: 3 }]);
  });

  await t.test('the reports can be narrowed, and bad ranges are refused', async () => {
    const short = await request(app).get('/api/admin/stats/revenue?days=3').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(short.body.series.length, 3);

    assert.equal((await request(app).get('/api/admin/stats/revenue?days=0').set('Authorization', `Bearer ${adminToken}`)).status, 422);
    assert.equal((await request(app).get('/api/admin/stats/revenue?days=999').set('Authorization', `Bearer ${adminToken}`)).status, 422);

    const popular = await request(app).get('/api/admin/stats/popular?limit=2').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(popular.body.items.length, 2);
    assert.ok(popular.body.items[0].quantity >= popular.body.items[1].quantity);

    assert.equal((await request(app).get('/api/admin/stats/popular?limit=50').set('Authorization', `Bearer ${adminToken}`)).status, 422);
  });

  await t.test('feedback can be listed and filtered, sentiment still to be worked out', async () => {
    const all = await request(app).get('/api/admin/feedback').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 3);
    assert.equal(all.body.feedback[0].sentiment, null);
    assert.ok(all.body.feedback[0].orderReference.startsWith('ORD-'));
    assert.ok(all.body.feedback[0].customerName, 'the customer is named for the restaurant');

    const five = await request(app).get('/api/admin/feedback?rating=5').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(five.body.total, 1);
    assert.equal(five.body.feedback[0].rating, 5);

    const unanalysed = await request(app).get('/api/admin/feedback?sentiment=not analysed'.replace(' ', '%20')).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(unanalysed.body.total, 3);

    assert.equal((await request(app).get('/api/admin/feedback?rating=9').set('Authorization', `Bearer ${adminToken}`)).status, 422);
  });

  await t.test('the figures move when a new order arrives', async () => {
    const before = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);

    const placed = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ fulfilment: 'pickup', items: [{ menuItemId: menuId, quantity: 2 }] });
    assert.equal(placed.status, 201);

    const after = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(after.body.orders.total, before.body.orders.total + 1);
    assert.ok(after.body.orders.revenue > before.body.orders.revenue);
    assert.equal(
      Number(after.body.orders.revenue.toFixed(2)),
      Number((before.body.orders.revenue + placed.body.order.total).toFixed(2)),
      'the new order is in the revenue straight away',
    );

    const popular = after.body.popularItems.find((item) => item.name === 'Margherita Pizza');
    assert.equal(popular.quantity, 5, 'the popular list counts the new order too');
  });
});

after(async () => {
  await closePools();
});
