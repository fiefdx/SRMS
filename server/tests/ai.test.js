/**
 * Backend AI tests: the assistant answering the six required questions from live database data, the
 * personal answers that need an account, and the feedback sentiment analysis.
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
const { classifySentiment } = await import('../src/services/ai/sentiment.js');

const uri = config.db.testUri;
const app = createApp();

let databaseAvailable = true;
try {
  await runMigration({ uri });
  databaseAvailable = await ping(uri);
} catch (error) {
  databaseAvailable = false;
  console.log(`Skipping AI tests: ${error.message}`);
}

const options = databaseAvailable ? {} : { skip: `MySQL is not reachable at ${uri}` };

test('sentiment classifier', async (t) => {
  await t.test('the star rating is the strongest signal', () => {
    assert.equal(classifySentiment('Pizza was excellent and the delivery was early.', 5).sentiment, 'positive');
    assert.equal(classifySentiment('Pasta was cold when we collected it, disappointing.', 2).sentiment, 'negative');
  });

  await t.test('the wording decides when the rating is middling', () => {
    const unhappy = classifySentiment('Waited an hour and the fish was not fresh.', 3);
    assert.equal(unhappy.sentiment, 'negative');
    assert.ok(unhappy.negative.length > 0, 'the reason is explainable');

    const happy = classifySentiment('Friendly staff, the salmon was delicious.', 3);
    assert.equal(happy.sentiment, 'positive');

    assert.equal(classifySentiment('We ate here on Tuesday.', 3).sentiment, 'neutral');
  });
});

test('assistant over HTTP', options, async (t) => {
  let customerToken;
  let adminToken;

  async function ask(question, token) {
    const call = request(app).post('/api/ai/ask').send({ question });
    if (token) call.set('Authorization', `Bearer ${token}`);
    const res = await call;
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  }

  before(async () => {
    await seedDatabase({ uri });
    customerToken = (await request(app).post('/api/auth/login').send({ email: 'demo@srms.dev', password: 'demo1234' })).body.token;
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@srms.dev', password: 'demo1234' })).body.token;
  });

  await t.test("today's specials come from the menu table", async () => {
    const answer = await ask("What are today's specials?");
    assert.equal(answer.intent, 'specials');
    assert.match(answer.text, /Chicken Alfredo/);
    assert.match(answer.text, /\$18\.99/);
  });

  await t.test('vegetarian and gluten-free questions list real dishes', async () => {
    const vegetarian = await ask('What vegetarian meals do you have?');
    assert.equal(vegetarian.intent, 'dietary');
    assert.match(vegetarian.text, /Margherita Pizza/);

    const glutenFree = await ask('Do you have gluten-free options?');
    assert.equal(glutenFree.intent, 'dietary');
    assert.match(glutenFree.text, /gluten-free/);
    assert.ok(glutenFree.text.length > 30);
  });

  await t.test('the recommendation is based on real orders', async () => {
    const answer = await ask('What do you recommend?');
    assert.equal(answer.intent, 'recommend');
    assert.deepEqual(answer.sources, ['order_items'], 'the answer is backed by order data');
    assert.match(answer.text, /Margherita Pizza/, 'the most ordered dish in the demo data');
  });

  await t.test('the most popular dessert is worked out, not remembered', async () => {
    const desserts = await (await import('../src/db/pool.js')).query("SELECT name FROM menu_items WHERE category = 'dessert'", [], uri);
    const names = desserts.map((row) => row.name);

    const answer = await ask('What is the most popular dessert?');
    assert.equal(answer.intent, 'popularDessert');
    assert.ok(names.some((name) => answer.text.includes(name.name ?? name)), `the answer names a dessert: ${answer.text}`);
  });

  await t.test('"what did I order last time" needs an account, then answers from the orders table', async () => {
    const guest = await ask('What did I order last time?');
    assert.match(guest.text, /sign in/i);

    const member = await ask('What did I order last time?', customerToken);
    assert.equal(member.intent, 'previousOrder');
    assert.match(member.text, /Your previous order was /);
    assert.match(member.text, /Margherita Pizza/);
  });

  await t.test('an order reference is only answered for its owner', async () => {
    const owner = await ask('Where is my order ORD-1001?', customerToken);
    assert.equal(owner.intent, 'orderStatus');
    assert.match(owner.text, /delivered/);

    const stranger = await request(app).post('/api/auth/register').send({ name: 'Curious Carl', email: `carl${Date.now()}@example.com`, password: 'secret123' });
    const notOwner = await ask('Where is my order ORD-1001?', stranger.body.token);
    assert.match(notOwner.text, /cannot find/i, 'no status is leaked to somebody else');
  });

  await t.test('hours, delivery and budget questions', async () => {
    const hours = await ask('What are your opening hours?');
    assert.equal(hours.intent, 'hours');
    assert.match(hours.text, /Monday/);

    const delivery = await ask('How much is delivery?');
    assert.equal(delivery.intent, 'delivery');
    assert.match(delivery.text, /\$3\.50/);
    assert.match(delivery.text, /\$40/);

    const budget = await ask('I want something spicy under $20');
    assert.equal(budget.intent, 'price');
    const prices = [...budget.text.matchAll(/\$(\d+\.\d{2})/g)].map((match) => Number(match[1]));
    assert.ok(prices.length > 0);
    assert.ok(prices.every((price) => price <= 20), `every suggestion is within budget: ${budget.text}`);
  });

  await t.test('a booking question gets a real free table', async () => {
    const answer = await ask('Can I book a table for 4?');
    assert.equal(answer.intent, 'availability');
    assert.match(answer.text, /is free on/);
    assert.match(answer.text, /\d{4}-\d{2}-\d{2}/);
  });

  await t.test('a question it cannot answer says so and offers the suggested questions', async () => {
    const answer = await ask('Do you sell bicycle parts?');
    assert.equal(answer.intent, 'fallback');
    assert.equal(answer.suggestedQuestions.length, 8);
  });

  await t.test('an empty question is refused before any work is done', async () => {
    assert.equal((await request(app).post('/api/ai/ask').send({ question: '' })).status, 422);
    assert.equal((await request(app).post('/api/ai/ask').send({ question: 'ok', extra: 'field' })).status, 422);
  });

  await t.test('the restaurant can analyse feedback sentiment', async () => {
    assert.equal((await request(app).post('/api/admin/feedback/analyze').send({})).status, 401);
    assert.equal((await request(app).post('/api/admin/feedback/analyze').set('Authorization', `Bearer ${customerToken}`).send({})).status, 403);

    const analysed = await request(app).post('/api/admin/feedback/analyze').set('Authorization', `Bearer ${adminToken}`).send({});
    assert.equal(analysed.status, 200);
    assert.equal(analysed.body.analysed, 3);
    assert.deepEqual(
      analysed.body.breakdown.find((row) => row.sentiment === 'positive').reviews,
      2,
    );
    assert.equal(analysed.body.breakdown.find((row) => row.sentiment === 'negative').reviews, 1);

    const stored = await queryOne('SELECT sentiment FROM feedback WHERE rating = 2', [], uri);
    assert.equal(stored.sentiment, 'negative', 'the label is written to the database');

    const again = await request(app).post('/api/admin/feedback/analyze').set('Authorization', `Bearer ${adminToken}`).send({});
    assert.equal(again.body.analysed, 0, 'already-labelled rows are left alone');

    const forced = await request(app).post('/api/admin/feedback/analyze').set('Authorization', `Bearer ${adminToken}`).send({ force: true });
    assert.equal(forced.body.analysed, 3, 'unless the admin asks for a full pass');

    const stats = await request(app).get('/api/admin/feedback/stats').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(stats.body.bySentiment.find((row) => row.sentiment === 'negative').reviews, 1);
  });

  await t.test('the written brief falls back to local rules when no AI provider is configured', async () => {
    const summary = await request(app).get('/api/admin/feedback/summary').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(summary.status, 200);
    assert.ok(summary.body.text.length > 20);
    assert.equal(summary.body.generatedBy, 'local');
    assert.ok(Array.isArray(summary.body.complaints));

    const wanted = await request(app).get('/api/admin/feedback/summary?provider=ai').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(wanted.status, 200);
    if (!config.ai.apiKey) {
      assert.match(wanted.body.note, /No AI provider configured/i);
      assert.equal(wanted.body.generatedBy, 'local');
    } else {
      assert.ok(wanted.body.generatedBy.length > 0);
    }
  });
});

after(async () => {
  await closePools();
});
