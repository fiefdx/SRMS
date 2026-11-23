/**
 * Menu management tests (MySQL required, skipped with a reason when it is not running).
 * Reads are checked for the customer-facing behaviour (filters, sorting, paging) and writes for the
 * admin-only rules and the side effects the frontend relies on.
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

const uri = config.db.testUri;
const app = createApp();

let databaseAvailable = true;
try {
  await runMigration({ uri });
  databaseAvailable = await ping(uri);
} catch (error) {
  databaseAvailable = false;
  console.log(`Skipping menu tests: ${error.message}`);
}

const options = databaseAvailable ? {} : { skip: `MySQL is not reachable at ${uri}` };

const NEW_DISH = {
  name: 'Test Truffle Risotto',
  category: 'main',
  description: 'Creamy risotto with black truffle (test dish).',
  price: 21.5,
  ingredients: ['arborio rice', 'truffle'],
  allergens: ['dairy'],
  dietaryTags: ['vegetarian'],
  available: true,
  todaySpecial: false,
  emoji: '🍚',
};

test('menu management', options, async (t) => {
  let adminToken;
  let customerToken;

  before(async () => {
    await seedDatabase({ uri });
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@srms.dev', password: 'demo1234' })).body.token;
    customerToken = (await request(app).post('/api/auth/login').send({ email: 'demo@srms.dev', password: 'demo1234' })).body.token;
  });

  await t.test('the menu is public and returns the seeded dishes in API shape', async () => {
    const res = await request(app).get('/api/menu');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 24);
    assert.equal(res.body.items.length, 24);

    const item = res.body.items[0];
    assert.equal(typeof item.price, 'number');
    assert.ok(Array.isArray(item.allergens));
    assert.equal(typeof item.available, 'boolean');
    assert.equal(item.dietaryTags === undefined, false, 'camelCase field names for the frontend');
    assert.equal(item.password_hash, undefined);
  });

  await t.test('filters match what the menu page offers', async () => {
    const desserts = await request(app).get('/api/menu?category=dessert');
    assert.equal(desserts.body.total, 4);
    assert.ok(desserts.body.items.every((item) => item.category === 'dessert'));

    const vegan = await request(app).get('/api/menu?dietary=vegan');
    assert.ok(vegan.body.total > 0);
    assert.ok(vegan.body.items.every((item) => item.dietaryTags.includes('vegan')), 'JSON_CONTAINS on the tag list');

    const glutenFree = await request(app).get('/api/menu?freeFrom=gluten');
    assert.ok(glutenFree.body.total > 0);
    assert.ok(glutenFree.body.items.every((item) => !item.allergens.includes('gluten')), 'allergen exclusion');

    const search = await request(app).get('/api/menu?search=pizza');
    assert.ok(search.body.items.some((item) => item.name === 'Margherita Pizza'));

    const specials = await request(app).get('/api/menu?todaySpecial=true');
    assert.equal(specials.body.total, 1);
    assert.equal(specials.body.items[0].name, 'Chicken Alfredo');

    const combined = await request(app).get('/api/menu?category=main&dietary=vegetarian');
    assert.ok(combined.body.total > 0);
    assert.ok(combined.body.items.every((item) => item.category === 'main' && item.dietaryTags.includes('vegetarian')));
  });

  await t.test('sorting and paging are done by the database', async () => {
    const byPrice = await request(app).get('/api/menu?sort=price&order=desc');
    const prices = byPrice.body.items.map((item) => item.price);
    assert.ok(prices.every((price, i) => i === 0 || prices[i - 1] >= price), 'prices descend');

    const byPopularity = await request(app).get('/api/menu?sort=popularity&order=desc');
    assert.equal(byPopularity.body.items[0].name, 'Margherita Pizza', 'popularity comes from the seeded orders');

    const page = await request(app).get('/api/menu?limit=5&offset=5');
    assert.equal(page.body.items.length, 5);
    assert.equal(page.body.total, 24);
    assert.equal(page.body.offset, 5);

    const first = await request(app).get('/api/menu?limit=5&offset=0');
    const firstIds = new Set(first.body.items.map((item) => item.id));
    assert.ok(page.body.items.every((item) => !firstIds.has(item.id)), 'the second page holds different rows');
  });

  await t.test('bad filter values are rejected instead of ignored', async () => {
    assert.equal((await request(app).get('/api/menu?category=entrees')).status, 422);
    assert.equal((await request(app).get('/api/menu?sort=calories')).status, 422);
    assert.equal((await request(app).get('/api/menu?limit=0')).status, 422);
    assert.equal((await request(app).get('/api/menu?limit=1000')).status, 422, 'the page size is capped');
    assert.equal((await request(app).get('/api/menu?orderBy=price')).status, 422, 'unknown parameters are refused');
  });

  await t.test('the facets endpoint counts the filter options', async () => {
    const res = await request(app).get('/api/menu/facets');
    assert.equal(res.status, 200);

    const categoryTotal = res.body.categories.reduce((sum, row) => sum + Number(row.items), 0);
    assert.equal(categoryTotal, 24);

    const vegan = res.body.dietaryTags.find((row) => row.tag === 'vegan');
    assert.ok(vegan, 'every dietary tag is reported');
    assert.ok(Number(vegan.items) > 0);
  });

  await t.test('a single dish can be read, unknown ids give the right status', async () => {
    const list = await request(app).get('/api/menu?search=Tiramisu');
    const id = list.body.items[0].id;

    const found = await request(app).get(`/api/menu/${id}`);
    assert.equal(found.status, 200);
    assert.equal(found.body.item.name, 'Tiramisu');

    assert.equal((await request(app).get('/api/menu/999999')).status, 404);
    assert.equal((await request(app).get('/api/menu/not-a-number')).status, 422);
  });

  await t.test('creating a dish is admin only and validates the payload', async () => {
    assert.equal((await request(app).post('/api/menu').send(NEW_DISH)).status, 401);
    assert.equal((await request(app).post('/api/menu').set('Authorization', `Bearer ${customerToken}`).send(NEW_DISH)).status, 403);

    const created = await request(app).post('/api/menu').set('Authorization', `Bearer ${adminToken}`).send(NEW_DISH);
    assert.equal(created.status, 201);
    assert.ok(created.body.item.id > 0);
    assert.equal(created.body.item.price, 21.5);
    assert.deepEqual(created.body.item.allergens, ['dairy']);

    const duplicate = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...NEW_DISH, description: 'Same name, different description.' });
    assert.equal(duplicate.status, 409, 'the unique index on the name is reported as a conflict');

    const freePrice = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...NEW_DISH, name: 'Free Risotto', price: 0 });
    assert.equal(freePrice.status, 422);

    const badCategory = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...NEW_DISH, name: 'Wrong Category', category: 'sides' });
    assert.equal(badCategory.status, 422);

    const withPopularity = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...NEW_DISH, name: 'Cheeky Popularity', popularity: 999 });
    assert.equal(withPopularity.status, 422, 'popularity is derived from orders, not posted by a client');
  });

  await t.test('an admin can change price, availability and the single daily special', async () => {
    const created = await request(app).post('/api/menu').set('Authorization', `Bearer ${adminToken}`).send({ ...NEW_DISH, name: 'Editable Risotto' });
    const id = created.body.item.id;

    assert.equal((await request(app).patch(`/api/menu/${id}`).set('Authorization', `Bearer ${customerToken}`).send({ price: 1 })).status, 403);
    assert.equal((await request(app).patch(`/api/menu/${id}`).set('Authorization', `Bearer ${adminToken}`).send({})).status, 422);
    assert.equal((await request(app).patch('/api/menu/999999').set('Authorization', `Bearer ${adminToken}`).send({ price: 9 })).status, 404);

    const changed = await request(app)
      .patch(`/api/menu/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 18.75, available: false });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.item.price, 18.75);
    assert.equal(changed.body.item.available, false);

    const unavailable = await request(app).get('/api/menu?available=false');
    assert.ok(unavailable.body.items.some((item) => item.id === id), 'the availability filter sees the change');

    const firstSpecial = await request(app).patch(`/api/menu/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ todaySpecial: true });
    assert.equal(firstSpecial.body.item.todaySpecial, true);

    const alfredo = await queryOne('SELECT id FROM menu_items WHERE name = ?', ['Chicken Alfredo'], uri);
    const secondSpecial = await request(app).patch(`/api/menu/${alfredo.id}`).set('Authorization', `Bearer ${adminToken}`).send({ todaySpecial: true });
    assert.equal(secondSpecial.body.item.todaySpecial, true);

    const specials = await request(app).get('/api/menu?todaySpecial=true');
    assert.equal(specials.body.total, 1, 'only one dish is today\'s special at a time');
    assert.equal(specials.body.items[0].name, 'Chicken Alfredo');
  });

  await t.test('deleting a dish keeps the order history readable', async () => {
    const burger = await queryOne(
      `SELECT mi.id, oi.name, oi.unit_price FROM menu_items mi JOIN order_items oi ON oi.menu_item_id = mi.id
        WHERE mi.name = 'Classic Beef Burger & Fries' LIMIT 1`,
      [],
      uri,
    );

    assert.equal((await request(app).delete(`/api/menu/${burger.id}`).set('Authorization', `Bearer ${customerToken}`)).status, 403);

    const removed = await request(app).delete(`/api/menu/${burger.id}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.deleted, true);

    assert.equal((await request(app).get(`/api/menu/${burger.id}`)).status, 404);

    const line = await queryOne(
      `SELECT oi.name, oi.menu_item_id, oi.unit_price, o.reference FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
       WHERE oi.name = ? LIMIT 1`,
      ['Classic Beef Burger & Fries'],
      uri,
    );
    assert.ok(line, 'the order line still exists');
    assert.equal(line.menu_item_id, null, 'only the link to the dish is removed');
    assert.equal(line.name, burger.name, 'the name sold at the time is kept');
    assert.equal(Number(line.unit_price), Number(burger.unit_price), 'and so is the price sold at the time');
  });
});

after(async () => {
  await closePools();
});
