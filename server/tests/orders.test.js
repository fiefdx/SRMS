/**
 * Order management tests (MySQL required, skipped with a reason when it is not running).
 * They cover the money being calculated by the server, the guest path, who may read and change which
 * order, the status flow, and one review per order.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');
const { default: config } = await import('../src/config/env.js');
const { runMigration } = await import('../src/db/migrate.js');
const { seedDatabase, closePools } = await import('../src/db/seed.js');
const { queryOne, ping } = await import('../src/db/pool.js');
import { DELIVERY_FEE, FREE_DELIVERY_FROM, TAX_RATE } from '../src/services/pricing.js';

const uri = config.db.testUri;
const app = createApp();

let databaseAvailable = true;
try {
  await runMigration({ uri });
  databaseAvailable = await ping(uri);
} catch (error) {
  databaseAvailable = false;
  console.log(`Skipping order tests: ${error.message}`);
}

const options = databaseAvailable ? {} : { skip: `MySQL is not reachable at ${uri}` };

const money = (value) => Number(value.toFixed(2));

test('order management', options, async (t) => {
  let adminToken;
  let customerToken;
  let customerId;
  let pizza;
  let coffee;

  async function menuByName(name) {
    const res = await request(app).get(`/api/menu?search=${encodeURIComponent(name)}`);
    return res.body.items.find((item) => item.name === name);
  }

  async function placeOrder(body, token) {
    const call = request(app).post('/api/orders').send(body);
    if (token) call.set('Authorization', `Bearer ${token}`);
    return call;
  }

  before(async () => {
    await seedDatabase({ uri });
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@srms.dev', password: 'demo1234' })).body.token;
    customerToken = (await request(app).post('/api/auth/login').send({ email: 'demo@srms.dev', password: 'demo1234' })).body.token;
    customerId = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${customerToken}`)).body.user.id;
    pizza = await menuByName('Margherita Pizza');
    coffee = await menuByName('Artisan Coffee');
  });

  await t.test('a customer order is priced by the server, not by the client', async () => {
    const res = await placeOrder(
      {
        fulfilment: 'delivery',
        deliveryAddress: '48 Harbour Street',
        notes: 'Ring the bell twice.',
        items: [
          { menuItemId: pizza.id, quantity: 1 },
          { menuItemId: pizza.id, quantity: 2 },
          { menuItemId: coffee.id, quantity: 1 },
        ],
      },
      customerToken,
    );

    assert.equal(res.status, 201);
    const order = res.body.order;

    assert.match(order.reference, /^ORD-\d+$/, 'a readable reference is generated');
    assert.equal(order.status, 'pending');
    assert.equal(order.userId, customerId);
    assert.equal(order.contact.email, 'demo@srms.dev', 'the account details are copied onto the order');

    assert.equal(order.items.length, 2, 'the same dish ordered twice becomes one line');
    assert.equal(order.items.find((line) => line.name === pizza.name).quantity, 3);
    assert.equal(order.items.find((line) => line.name === pizza.name).unitPrice, pizza.price, 'prices come from the menu table');

    const subtotal = money(pizza.price * 3 + coffee.price);
    assert.equal(order.subtotal, subtotal);
    assert.equal(order.deliveryFee, subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE);
    assert.equal(order.tax, money(subtotal * TAX_RATE));
    assert.equal(order.total, money(subtotal + order.deliveryFee + order.tax));
  });

  await t.test('a client cannot send its own prices', async () => {
    const res = await placeOrder(
      { fulfilment: 'pickup', items: [{ menuItemId: pizza.id, quantity: 1, unitPrice: 0.01 }], total: 0.01 },
      customerToken,
    );
    assert.equal(res.status, 422, 'the payload only accepts dish ids and quantities');
  });

  await t.test('delivery needs an address, pickup never pays a fee, free delivery starts at the threshold', async () => {
    const noAddress = await placeOrder({ fulfilment: 'delivery', items: [{ menuItemId: coffee.id, quantity: 1 }] }, customerToken);
    assert.equal(noAddress.status, 422);
    assert.equal(noAddress.body.error.details[0].field, 'deliveryAddress');

    const pickup = await placeOrder({ fulfilment: 'pickup', items: [{ menuItemId: coffee.id, quantity: 1 }] }, customerToken);
    assert.equal(pickup.status, 201);
    assert.equal(pickup.body.order.deliveryFee, 0);

    const big = await placeOrder(
      { fulfilment: 'delivery', deliveryAddress: '48 Harbour Street', items: [{ menuItemId: pizza.id, quantity: 4 }] },
      customerToken,
    );
    assert.ok(big.body.order.subtotal >= FREE_DELIVERY_FROM);
    assert.equal(big.body.order.deliveryFee, 0, 'free delivery above the threshold');
  });

  await t.test('a guest can order if contact details are given', async () => {
    const withoutContact = await placeOrder({ fulfilment: 'pickup', items: [{ menuItemId: coffee.id, quantity: 1 }] });
    assert.equal(withoutContact.status, 422);
    assert.equal(withoutContact.body.error.details[0].field, 'contact.email');

    const guest = await placeOrder({
      fulfilment: 'delivery',
      deliveryAddress: '5 Side Street',
      contact: { name: 'Guest Person', email: 'Guest@Example.com', phone: '+1 555 0300' },
      items: [{ menuItemId: pizza.id, quantity: 1 }],
    });

    assert.equal(guest.status, 201);
    assert.equal(guest.body.order.userId, null);
    assert.equal(guest.body.order.contact.email, 'guest@example.com');
  });

  await t.test('dishes that are unknown, off the menu or empty carts are refused per line', async () => {
    const empty = await placeOrder({ fulfilment: 'pickup', items: [] }, customerToken);
    assert.equal(empty.status, 422);
    assert.match(empty.body.error.details[0].message, /cart is empty/i);

    const unknown = await placeOrder({ fulfilment: 'pickup', items: [{ menuItemId: 999999, quantity: 1 }] }, customerToken);
    assert.equal(unknown.status, 422);
    assert.match(unknown.body.error.details[0].message, /not on the menu/i);

    const switched = await request(app).patch(`/api/menu/${coffee.id}`).set('Authorization', `Bearer ${adminToken}`).send({ available: false });
    assert.equal(switched.body.item.available, false);

    const unavailable = await placeOrder({ fulfilment: 'pickup', items: [{ menuItemId: coffee.id, quantity: 1 }] }, customerToken);
    assert.equal(unavailable.status, 422);
    assert.match(unavailable.body.error.details[0].message, /no longer available/i);

    await request(app).patch(`/api/menu/${coffee.id}`).set('Authorization', `Bearer ${adminToken}`).send({ available: true });
  });

  await t.test('the order list is scoped to the customer, admins see everything', async () => {
    const anonymous = await request(app).get('/api/orders');
    assert.equal(anonymous.status, 401);

    const mine = await request(app).get('/api/orders').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.orders.length >= 4);
    assert.ok(mine.body.orders.every((order) => order.userId === customerId), 'a customer never sees another customer orders');

    const all = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`);
    assert.ok(all.body.total > mine.body.total);

    const delivered = await request(app).get('/api/orders?status=delivered').set('Authorization', `Bearer ${adminToken}`);
    assert.ok(delivered.body.orders.length > 0);
    assert.ok(delivered.body.orders.every((order) => order.status === 'delivered'));

    const search = await request(app).get(`/api/orders?search=${mine.body.orders[0].reference}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(search.body.total, 1);

    assert.equal((await request(app).get('/api/orders?status=cooking').set('Authorization', `Bearer ${adminToken}`)).status, 422);
  });

  await t.test('one order can be read by its owner or an admin, nobody else', async () => {
    const mine = await request(app).get('/api/orders').set('Authorization', `Bearer ${customerToken}`);
    const orderId = mine.body.orders[0].id;

    const stranger = await request(app).post('/api/auth/register').send({ name: 'Nosy Neighbour', email: `nosy${Date.now()}@example.com`, password: 'secret123' });

    assert.equal((await request(app).get(`/api/orders/${orderId}`)).status, 401);
    assert.equal((await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${stranger.body.token}`)).status, 403);
    assert.equal((await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${customerToken}`)).status, 200);
    assert.equal((await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${adminToken}`)).status, 200);
    assert.equal((await request(app).get('/api/orders/999999').set('Authorization', `Bearer ${adminToken}`)).status, 404);
    assert.equal((await request(app).get('/api/orders/not-a-number').set('Authorization', `Bearer ${adminToken}`)).status, 422);
  });

  await t.test('the receipt lookup needs the reference and, for guests, the email', async () => {
    const guestOrder = await request(app).get('/api/orders/reference/ORD-1006?email=guest@example.com');
    assert.equal(guestOrder.status, 200);
    assert.equal(guestOrder.body.order.reference, 'ORD-1006');

    const wrongEmail = await request(app).get('/api/orders/reference/ORD-1006?email=someone@example.com');
    assert.equal(wrongEmail.status, 403);

    const accountOrder = await request(app).get('/api/orders/reference/ORD-1001?email=demo@srms.dev');
    assert.equal(accountOrder.status, 403, 'an order that belongs to an account is never released by an email match');

    const asOwner = await request(app).get('/api/orders/reference/ORD-1001?email=demo@srms.dev').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(asOwner.status, 200);

    assert.equal((await request(app).get('/api/orders/reference/ORD-9999?email=a@b.com')).status, 404);
    assert.equal((await request(app).get('/api/orders/reference/receipt-12?email=a@b.com')).status, 422);
    assert.equal((await request(app).get('/api/orders/reference/ORD-1006')).status, 422, 'the email is required');
  });

  await t.test('the items of a pending order can be replaced and the totals are recalculated', async () => {
    const placed = await placeOrder({ fulfilment: 'pickup', items: [{ menuItemId: coffee.id, quantity: 1 }] }, customerToken);
    const orderId = placed.body.order.id;

    const changed = await request(app)
      .patch(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ menuItemId: pizza.id, quantity: 2 }, { menuItemId: coffee.id, quantity: 2 }] });

    assert.equal(changed.status, 200);
    assert.equal(changed.body.order.items.length, 2);
    const expectedSubtotal = money(pizza.price * 2 + coffee.price * 2);
    assert.equal(changed.body.order.subtotal, expectedSubtotal);
    assert.equal(changed.body.order.total, money(expectedSubtotal + expectedSubtotal * TAX_RATE));

    const emptyCart = await request(app).patch(`/api/orders/${orderId}/items`).set('Authorization', `Bearer ${customerToken}`).send({ items: [] });
    assert.equal(emptyCart.status, 422);

    await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'preparing' });
    const tooLate = await request(app)
      .patch(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ menuItemId: coffee.id, quantity: 1 }] });
    assert.equal(tooLate.status, 409, 'a preparing order is fixed');
  });

  await t.test('the status flow is enforced, and only an admin moves an order along it', async () => {
    const placed = await placeOrder({ fulfilment: 'pickup', items: [{ menuItemId: coffee.id, quantity: 2 }] }, customerToken);
    const orderId = placed.body.order.id;

    assert.equal((await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'preparing' })).status, 403);

    const jumped = await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'delivered' });
    assert.equal(jumped.status, 409);
    assert.deepEqual(jumped.body.error.details.allowed, ['preparing', 'cancelled'], 'the response says what is allowed next');

    for (const status of ['preparing', 'ready', 'delivered']) {
      const res = await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status, note: `moved to ${status}` });
      assert.equal(res.status, 200);
      assert.equal(res.body.order.status, status);
    }

    const back = await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'pending' });
    assert.equal(back.status, 409, 'a delivered order cannot be reopened');

    const stored = await queryOne('SELECT notes FROM orders WHERE id = ?', [orderId], uri);
    assert.match(stored.notes, /moved to delivered/, 'the admin note is kept on the order');

    assert.equal((await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'cancelled' })).status, 409, 'a delivered order cannot be cancelled by the customer');
  });

  await t.test('a customer can cancel their own order while it is pending', async () => {
    const placed = await placeOrder({ fulfilment: 'delivery', deliveryAddress: '9 Vine Terrace', items: [{ menuItemId: pizza.id, quantity: 1 }] }, customerToken);
    const orderId = placed.body.order.id;

    const cancelled = await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'cancelled' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.order.status, 'cancelled');

    const somebodyElse = await request(app).post('/api/auth/register').send({ name: 'Canceller', email: `cancel${Date.now()}@example.com`, password: 'secret123' });
    const seeded = await queryOne("SELECT id FROM orders WHERE reference = 'ORD-1003'", [], uri);
    const refused = await request(app).patch(`/api/orders/${seeded.id}/status`).set('Authorization', `Bearer ${somebodyElse.body.token}`).send({ status: 'cancelled' });
    assert.equal(refused.status, 403, 'a customer cannot cancel an order that is not theirs');
  });

  await t.test('one review per delivered order, sentiment left for the AI feature', async () => {
    const placed = await placeOrder({ fulfilment: 'pickup', items: [{ menuItemId: coffee.id, quantity: 1 }] }, customerToken);
    const orderId = placed.body.order.id;
    for (const status of ['preparing', 'ready', 'delivered']) {
      await request(app).patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status });
    }

    const stranger = await request(app).post('/api/auth/register').send({ name: 'Reviewer', email: `review${Date.now()}@example.com`, password: 'secret123' });
    assert.equal((await request(app).post(`/api/orders/${orderId}/feedback`).set('Authorization', `Bearer ${stranger.body.token}`).send({ rating: 5, comment: 'Great coffee.' })).status, 403);

    const badRating = await request(app).post(`/api/orders/${orderId}/feedback`).set('Authorization', `Bearer ${customerToken}`).send({ rating: 6, comment: 'Loved it.' });
    assert.equal(badRating.status, 422);

    const review = await request(app).post(`/api/orders/${orderId}/feedback`).set('Authorization', `Bearer ${customerToken}`).send({ rating: 4, comment: 'Coffee was great, a bit slow.' });
    assert.equal(review.status, 201);
    assert.equal(review.body.feedback.sentiment, null, 'the AI feedback analysis fills this in later');

    const twice = await request(app).post(`/api/orders/${orderId}/feedback`).set('Authorization', `Bearer ${customerToken}`).send({ rating: 2, comment: 'Changed my mind.' });
    assert.equal(twice.status, 409);

    const cancelledOrder = await queryOne("SELECT id FROM orders WHERE reference = 'ORD-1005'", [], uri);
    const onCancelled = await request(app).post(`/api/orders/${cancelledOrder.id}/feedback`).set('Authorization', `Bearer ${adminToken}`).send({ rating: 3, comment: 'Never arrived.' });
    assert.equal(onCancelled.status, 409);
  });
});

after(async () => {
  await closePools();
});
