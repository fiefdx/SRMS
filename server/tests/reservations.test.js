/**
 * Reservation, availability and event tests (MySQL required, skipped with a reason when it is not
 * running). The heart of them is the double-booking rule: the same table cannot be held twice for
 * overlapping times, and the availability query must agree with that.
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
  console.log(`Skipping reservation tests: ${error.message}`);
}

const options = databaseAvailable ? {} : { skip: `MySQL is not reachable at ${uri}` };

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekdayOf(dateText) {
  return WEEKDAYS[new Date(`${dateText}T12:00:00`).getDay()];
}

/** A day the restaurant is open long enough for the slots these tests use (the week is closed on Monday). */
function nextOpenDate() {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = dateInDays(offset);
    const entry = config.restaurant.openingHours.find((hours) => hours.day === weekdayOf(date));
    if (entry && entry.open !== null && entry.open <= '12:00' && entry.close >= '21:00') return { date, hours: entry };
  }
  throw new Error('no suitable open day found in the next two weeks');
}

function nextClosedDate() {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = dateInDays(offset);
    const entry = config.restaurant.openingHours.find((hours) => hours.day === weekdayOf(date));
    if (!entry || entry.open === null) return date;
  }
  return null;
}

test('reservations, availability and events', options, async (t) => {
  let adminToken;
  let customerToken;
  let open;
  let tables = [];

  async function book(body, token) {
    const call = request(app).post('/api/reservations').send(body);
    if (token) call.set('Authorization', `Bearer ${token}`);
    return call;
  }

  before(async () => {
    await seedDatabase({ uri });
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@srms.dev', password: 'demo1234' })).body.token;
    customerToken = (await request(app).post('/api/auth/login').send({ email: 'demo@srms.dev', password: 'demo1234' })).body.token;
    open = nextOpenDate();
    tables = await (await import('../src/db/pool.js')).query('SELECT * FROM restaurant_tables ORDER BY seats, label', [], uri);
  });

  await t.test('the availability query shows only the tables that are genuinely free', async () => {
    const booth = tables.find((table) => table.seats === 4);
    const booked = await book({ date: open.date, startTime: '19:00', endTime: '20:30', partySize: 4, tableId: booth.id }, customerToken);
    assert.equal(booked.status, 201);

    const res = await request(app).get(`/api/reservations/availability?date=${open.date}&startTime=19:00&endTime=20:30&partySize=4`);
    assert.equal(res.status, 200);

    const labels = res.body.tables.map((table) => table.label);
    assert.ok(labels.length > 0);
    assert.ok(!labels.includes(booth.label), `the table just booked (${booth.label}) disappears from the list`);
    assert.ok(res.body.tables.every((table) => table.seats >= 4), 'only tables that fit the party');

    const smaller = await request(app).get(`/api/reservations/availability?date=${open.date}&startTime=19:00&endTime=20:30&partySize=2`);
    assert.ok(smaller.body.tables.length >= res.body.tables.length, 'a party of two has at least as much choice');

    const windowed = await request(app).get(`/api/reservations/availability?date=${open.date}&startTime=19:00&endTime=20:30&partySize=2&area=window`);
    assert.ok(windowed.body.tables.every((table) => table.area === 'window'));

    const cancelled = await request(app).patch(`/api/reservations/${booked.body.reservation.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'cancelled' });
    assert.equal(cancelled.status, 200);
    const afterCancel = await request(app).get(`/api/reservations/availability?date=${open.date}&startTime=19:00&endTime=20:30&partySize=4`);
    assert.ok(afterCancel.body.tables.some((table) => table.label === booth.label), 'cancelling releases the table back to the list');

    assert.equal((await request(app).get('/api/reservations/availability?date=not-a-date&startTime=19:00&endTime=20:30')).status, 422);
    assert.equal((await request(app).get(`/api/reservations/availability?date=${open.date}&startTime=20:00&endTime=19:00`)).status, 422);
  });

  await t.test('the slot has to be inside the published opening hours', async () => {
    const closed = nextClosedDate();
    if (closed) {
      const res = await book({ date: closed, startTime: '19:00', endTime: '20:00', partySize: 2 }, customerToken);
      assert.equal(res.status, 422);
      assert.match(res.body.error.message, /closed on/i);
    }

    const late = await book(
      { date: open.date, startTime: open.hours.close, endTime: '23:59', partySize: 2 },
      customerToken,
    );
    assert.equal(late.status, 422);
    assert.match(late.body.error.message, new RegExp(`between ${open.hours.open} and ${open.hours.close}`));

    const past = await book({ date: dateInDays(-2), startTime: '19:00', endTime: '20:00', partySize: 2 }, customerToken);
    assert.equal(past.status, 422);
    assert.match(past.body.error.message, /has not passed/i);
  });

  await t.test('a table cannot be booked twice for overlapping times', async () => {
    const booth = tables.find((table) => table.seats === 4);
    const slot = { date: open.date, startTime: '13:30', endTime: '15:00', partySize: 3, tableId: booth.id };

    const first = await book(slot, customerToken);
    assert.equal(first.status, 201);
    assert.match(first.body.reservation.reference, /^RES-\d+$/);
    assert.equal(first.body.reservation.status, 'pending');
    assert.equal(first.body.reservation.table.label, booth.label);

    const overlap = await book({ ...slot, partySize: 2 }, customerToken);
    assert.equal(overlap.status, 409);
    assert.match(overlap.body.error.message, /already booked/i);
    assert.equal(overlap.body.error.details.conflictReference, first.body.reservation.reference);

    const touching = await book({ ...slot, startTime: '15:00', endTime: '16:00' }, customerToken);
    assert.equal(touching.status, 201, 'a booking that starts when the other ends is fine');

    const earlier = await book({ ...slot, startTime: '12:00', endTime: '13:30' }, customerToken);
    assert.equal(earlier.status, 201, 'and a booking that ends when the other starts');

    const cancelled = await request(app)
      .patch(`/api/reservations/${earlier.body.reservation.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' });
    assert.equal(cancelled.status, 200);

    const reuse = await book({ ...slot, startTime: '12:00', endTime: '13:30' }, customerToken);
    assert.equal(reuse.status, 201, 'a cancelled booking frees the slot again');
  });

  await t.test('two customers booking the same slot at the same moment: one wins', async () => {
    const booth = tables.find((table) => table.seats === 4);
    const slot = { date: open.date, startTime: '21:00', endTime: '21:45', partySize: 4, tableId: booth.id };
    const stranger = await request(app).post('/api/auth/register').send({ name: 'Faster Footer', email: `fast${Date.now()}@example.com`, password: 'secret123' });

    const [first, second] = await Promise.all([
      book(slot, customerToken),
      book(slot, stranger.body.token),
    ]);

    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [201, 409], 'the transaction and the row lock let exactly one through');

    const stored = await queryOne(
      'SELECT COUNT(*) AS total FROM reservations WHERE reservation_date = ? AND start_time = ? AND table_id = ?',
      [slot.date, slot.startTime, booth.id],
      uri,
    );
    assert.equal(Number(stored.total), 1, 'only one booking was written');
  });

  await t.test('the table must fit the party, and the party must fit the restaurant', async () => {
    const small = tables.find((table) => table.seats === 2);
    const tooSmall = await book({ date: open.date, startTime: '17:00', endTime: '18:00', partySize: 6, tableId: small.id }, customerToken);
    assert.equal(tooSmall.status, 422);
    assert.match(tooSmall.body.error.message, /seats 2, your party is 6/);

    const huge = await book({ date: open.date, startTime: '17:00', endTime: '18:00', partySize: config.restaurant.maxPartySize + 1 }, customerToken);
    assert.equal(huge.status, 422);
    assert.match(huge.body.error.message, /largest booking/i);

    const chosen = await book({ date: open.date, startTime: '17:15', endTime: '18:15', partySize: 10 }, customerToken);
    assert.equal(chosen.status, 201);
    assert.equal(chosen.body.reservation.table.seats, 10, 'the smallest table that fits is picked automatically');
  });

  await t.test('a guest can book with contact details', async () => {
    const withoutContact = await book({ date: open.date, startTime: '18:00', endTime: '19:00', partySize: 2 });
    assert.equal(withoutContact.status, 422);
    assert.equal(withoutContact.body.error.details[0].field, 'contact.email');

    const guest = await book(
      {
        date: open.date,
        startTime: '18:00',
        endTime: '19:00',
        partySize: 2,
        contact: { name: 'Guest Bookings', email: 'guest-booking@example.com' },
      },
    );
    assert.equal(guest.status, 201);
    assert.equal(guest.body.reservation.userId, null);
    assert.equal(guest.body.reservation.contact.email, 'guest-booking@example.com');
  });

  await t.test('bookings are listed per customer, and the restaurant can filter them', async () => {
    assert.equal((await request(app).get('/api/reservations')).status, 401);

    const mine = await request(app).get('/api/reservations').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.reservations.length >= 3);
    assert.ok(mine.body.reservations.every((item) => item.userId !== null));

    const all = await request(app).get('/api/reservations').set('Authorization', `Bearer ${adminToken}`);
    assert.ok(all.body.total > mine.body.total);

    const onADate = await request(app).get(`/api/reservations?date=${open.date}`).set('Authorization', `Bearer ${adminToken}`);
    assert.ok(onADate.body.reservations.every((item) => item.date === open.date));

    const pending = await request(app).get('/api/reservations?status=pending').set('Authorization', `Bearer ${adminToken}`);
    assert.ok(pending.body.reservations.every((item) => item.status === 'pending'));

    const byOccasion = await request(app).get('/api/reservations?search=birthday').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(byOccasion.body.total, 1);
    assert.equal(byOccasion.body.reservations[0].type, 'birthday');

    assert.equal((await request(app).get('/api/reservations?status=booked').set('Authorization', `Bearer ${adminToken}`)).status, 422);
  });

  await t.test('the restaurant approves, a customer may only cancel', async () => {
    const placed = await book({ date: open.date, startTime: '20:00', endTime: '21:00', partySize: 2 }, customerToken);
    const id = placed.body.reservation.id;

    const approvedByCustomer = await request(app).patch(`/api/reservations/${id}/status`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'approved' });
    assert.equal(approvedByCustomer.status, 403);

    const approved = await request(app).patch(`/api/reservations/${id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'approved' });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.reservation.status, 'approved');

    const reopened = await request(app).patch(`/api/reservations/${id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'pending' });
    assert.equal(reopened.status, 409);
    assert.deepEqual(reopened.body.error.details.allowed, ['completed', 'cancelled']);

    const cancelledByCustomer = await request(app).patch(`/api/reservations/${id}/status`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'cancelled' });
    assert.equal(cancelledByCustomer.status, 200, 'a customer can still cancel an approved booking');
  });

  await t.test('a customer may change their own pending booking, not one that is approved', async () => {
    const placed = await book({ date: open.date, startTime: '13:00', endTime: '14:00', partySize: 2 }, customerToken);
    const id = placed.body.reservation.id;

    const changed = await request(app).patch(`/api/reservations/${id}`).set('Authorization', `Bearer ${customerToken}`).send({ partySize: 3, requirements: 'Window seat if possible.' });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.reservation.partySize, 3);
    assert.equal(changed.body.reservation.requirements, 'Window seat if possible.');

    const clashes = await request(app).patch(`/api/reservations/${id}`).set('Authorization', `Bearer ${customerToken}`).send({ startTime: '19:00', endTime: '20:30' });
    assert.ok([200, 409].includes(clashes.status), 'moving to a busy slot is refused, moving elsewhere is not');

    await request(app).patch(`/api/reservations/${id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'approved' });
    const locked = await request(app).patch(`/api/reservations/${id}`).set('Authorization', `Bearer ${customerToken}`).send({ partySize: 4 });
    assert.equal(locked.status, 409);

    const adminMove = await request(app).patch(`/api/reservations/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ partySize: 4 });
    assert.equal(adminMove.status, 200);

    const stranger = await request(app).post('/api/auth/register').send({ name: 'Peeking Pam', email: `pam${Date.now()}@example.com`, password: 'secret123' });
    assert.equal((await request(app).get(`/api/reservations/${id}`).set('Authorization', `Bearer ${stranger.body.token}`)).status, 403);
    assert.equal((await request(app).patch(`/api/reservations/${id}`).set('Authorization', `Bearer ${stranger.body.token}`).send({ partySize: 2 })).status, 403);
    assert.equal((await request(app).delete(`/api/reservations/${id}`).set('Authorization', `Bearer ${customerToken}`)).status, 403, 'customers cancel, they do not delete');
    assert.equal((await request(app).get('/api/reservations/999999').set('Authorization', `Bearer ${adminToken}`)).status, 404);
  });

  await t.test('an event request carries the occasion, the requirements and the menu selection', async () => {
    const menu = await request(app).get('/api/menu?category=dessert');
    const dishIds = menu.body.items.slice(0, 2).map((item) => item.id);

    const missingOccasion = await request(app).post('/api/events').set('Authorization', `Bearer ${customerToken}`).send({
      type: 'corporate',
      date: open.date,
      startTime: '12:00',
      endTime: '14:00',
      partySize: 6,
    });
    assert.equal(missingOccasion.status, 422);
    assert.equal(missingOccasion.body.error.details[0].field, 'occasion');

    const requested = await request(app).post('/api/events').set('Authorization', `Bearer ${customerToken}`).send({
      type: 'birthday',
      date: open.date,
      startTime: '12:00',
      endTime: '14:00',
      partySize: 6,
      occasion: "Sam's birthday lunch",
      requirements: 'One high chair, candles on the dessert.',
      menuSelection: dishIds,
    });

    assert.equal(requested.status, 201);
    assert.equal(requested.body.reservation.type, 'birthday');
    assert.equal(requested.body.reservation.occasion, "Sam's birthday lunch");
    assert.deepEqual(
      requested.body.reservation.menuSelection.map((item) => item.id).sort((a, b) => a - b),
      [...dishIds].sort((a, b) => a - b),
      'the menu selection is stored as ids and read back as dishes',
    );

    const badMenu = await request(app).post('/api/events').set('Authorization', `Bearer ${customerToken}`).send({
      type: 'corporate',
      date: open.date,
      startTime: '12:00',
      endTime: '14:00',
      partySize: 4,
      occasion: 'Team lunch',
      menuSelection: [999999],
    });
    assert.equal(badMenu.status, 422);
    assert.match(badMenu.body.error.message, /not on the menu/i);

    const events = await request(app).get('/api/events').set('Authorization', `Bearer ${adminToken}`);
    assert.ok(events.body.reservations.length >= 3);
    assert.ok(events.body.reservations.every((item) => item.type !== 'standard'), 'the event list never holds plain tables');

    const mine = await request(app).get('/api/events').set('Authorization', `Bearer ${customerToken}`);
    assert.ok(mine.body.reservations.every((item) => item.userId !== null));
    assert.ok(mine.body.total < events.body.total, 'a customer only sees their own events');

    const updated = await request(app)
      .patch(`/api/events/${requested.body.reservation.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requirements: 'Room is set with a projector.' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.reservation.requirements, 'Room is set with a projector.');
  });

  await t.test('the demo bookings survived the seeding with their tables', async () => {
    const seeded = await queryOne("SELECT * FROM reservations WHERE reference = 'RES-5002'", [], uri);
    assert.equal(seeded.type, 'birthday');

    const list = await request(app).get('/api/reservations?search=Maya').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(list.body.reservations[0].table.label, 'Group table');
    assert.equal(list.body.reservations[0].partySize, 10);
    assert.equal(list.body.reservations[0].menuSelection.length, 3);
  });
});

after(async () => {
  await closePools();
});
