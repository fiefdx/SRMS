/**
 * Reservation and event rules, including the part the brief calls out: **a table cannot be booked twice
 * for the same time.**
 *
 * The check is done inside a transaction with `SELECT ... FOR UPDATE`, not as a unique index: a cancelled
 * booking must not keep a table blocked, and the overlap test is a range comparison
 * (`start_time < :end AND end_time > :start`), which a unique key cannot express. The locking read holds
 * the slot until the INSERT is committed, so two customers clicking "book" at the same moment cannot both
 * succeed.
 *
 * Other rules, all in one place: the slot must be inside the published opening hours, the date must be in
 * the future, the table must have room for the party, the party must fit the restaurant's maximum, and an
 * event booking needs an occasion. If the customer does not choose a table, the smallest free table that
 * fits is picked.
 */
import { randomUUID } from 'node:crypto';
import config from '../config/env.js';
import { execute, getPool, query, queryOne, withTransaction } from '../db/pool.js';
import ApiError from '../utils/ApiError.js';
import { toReservation, menuSelectionIds } from '../mappers/reservation.js';
import { toMenuItem } from '../mappers/menuItem.js';

export const RESERVATION_STATUS_FLOW = {
  pending: ['approved', 'cancelled'],
  approved: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SELECT_WITH_TABLE = `
  SELECT r.*, t.label AS table_label, t.seats AS table_seats, t.area AS table_area
    FROM reservations r
    LEFT JOIN restaurant_tables t ON t.id = r.table_id`;

function referenceForId(id) {
  return `RES-${id + 5000}`;
}

function placeholderReference() {
  return `tmp-${randomUUID().slice(0, 16)}`;
}

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function openingHoursFor(date) {
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00`).getDay()];
  const entry = config.restaurant.openingHours.find((hours) => hours.day === weekday);
  return { weekday, entry };
}

/** "19:00" -> 1140 minutes, so the comparisons are numbers rather than string tricks. */
function minutes(time) {
  const [hours, minutes_] = time.split(':').map(Number);
  return hours * 60 + minutes_;
}

function assertSlotIsOpen(date, startTime, endTime) {
  if (date < today()) throw ApiError.unprocessable('Choose a date that has not passed yet', [{ field: 'date' }]);

  const { weekday, entry } = openingHoursFor(date);
  if (!entry || entry.open === null) {
    throw ApiError.unprocessable(`The restaurant is closed on ${weekday}`, [{ field: 'date' }]);
  }

  if (minutes(startTime) < minutes(entry.open) || minutes(endTime) > minutes(entry.close)) {
    throw ApiError.unprocessable(`On ${weekday} we serve between ${entry.open} and ${entry.close}`, [
      { field: 'startTime', open: entry.open, close: entry.close },
    ]);
  }

  if (date === today() && minutes(startTime) < minutes(new Date().toTimeString().slice(0, 5))) {
    throw ApiError.unprocessable('That start time has already passed today', [{ field: 'startTime' }]);
  }
}

async function loadTables({ partySize, area }, uri) {
  const where = ['seats >= ?'];
  const params = [partySize];
  if (area) {
    where.push('area = ?');
    params.push(area);
  }
  return query(`SELECT * FROM restaurant_tables WHERE ${where.join(' AND ')} ORDER BY seats, label`, params, uri);
}

/**
 * The double-booking guard. Runs on the transaction's connection so the rows it reads are locked until
 * the booking is inserted (a gap lock also blocks an identical INSERT from another session).
 */
async function assertTableIsFree(connection, { tableId, date, startTime, endTime, excludeId }) {
  const params = [date, tableId, endTime, startTime];
  let sql = `SELECT id, reference, start_time, end_time, party_size
               FROM reservations
              WHERE reservation_date = ? AND table_id = ? AND status <> 'cancelled'
                AND start_time < ? AND end_time > ?`;
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' FOR UPDATE';

  const [rows] = await connection.query(sql, params);
  if (rows.length === 0) return;

  const clash = rows[0];
  throw ApiError.conflict(
    `That table is already booked from ${clash.start_time} to ${clash.end_time}`,
    {
      conflictReference: clash.reference,
      overlap: { from: clash.start_time, to: clash.end_time },
    },
    'TABLE_ALREADY_BOOKED',
  );
}

async function assertMenuSelection(ids, uri) {
  if (!ids?.length) return;
  const rows = await query('SELECT id FROM menu_items WHERE id IN (?)', [ids], uri);
  const known = new Set(rows.map((row) => row.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) {
    throw ApiError.unprocessable('Some dishes in the menu selection are not on the menu', unknown.map((id) => ({ field: 'menuSelection', value: id })));
  }
}

async function loadReservationRow(id, uri) {
  return queryOne(`${SELECT_WITH_TABLE} WHERE r.id = ?`, [id], uri);
}

export async function getReservationById(id, uri) {
  const row = await loadReservationRow(id, uri);
  if (!row) return null;

  const ids = menuSelectionIds(row);
  const dishes = ids.length ? await query('SELECT * FROM menu_items WHERE id IN (?)', [ids], uri) : [];
  return toReservation(row, ids.map((id) => toMenuItem(dishes.find((dish) => dish.id === id))).filter(Boolean));
}

export async function createReservation({ payload, actor }, uri) {
  if (!actor && !payload.contact?.email) {
    throw ApiError.unprocessable('A guest booking needs a name and email so we can confirm it', [{ field: 'contact.email' }]);
  }

  assertSlotIsOpen(payload.date, payload.startTime, payload.endTime);
  await assertMenuSelection(payload.menuSelection, uri);

  if (payload.partySize > config.restaurant.maxPartySize) {
    throw ApiError.unprocessable(`The largest booking we take online is ${config.restaurant.maxPartySize} guests`, [
      { field: 'partySize', max: config.restaurant.maxPartySize },
    ]);
  }

  const contact = {
    name: payload.contact?.name ?? actor?.name ?? null,
    email: payload.contact?.email ?? actor?.email ?? null,
    phone: payload.contact?.phone ?? actor?.phone ?? null,
  };

  const reservationId = await withTransaction(
    async (connection) => {
      /* Which table? A chosen one must exist and fit the party; otherwise take the smallest free table. */
      let table = null;
      if (payload.tableId) {
        const [found] = await connection.query('SELECT * FROM restaurant_tables WHERE id = ?', [payload.tableId]);
        if (found.length === 0) throw ApiError.unprocessable('That table does not exist', [{ field: 'tableId' }]);
        table = found[0];
        if (table.seats < payload.partySize) {
          throw ApiError.unprocessable(`${table.label} seats ${table.seats}, your party is ${payload.partySize}`, [
            { field: 'tableId', label: table.label, seats: table.seats },
          ]);
        }
      } else {
        const candidates = await connection.query(
          'SELECT * FROM restaurant_tables WHERE seats >= ? ORDER BY seats, label FOR UPDATE',
          [payload.partySize],
        );
        const free = candidates[0];
        if (!free[0]) throw ApiError.conflict(`No table seats ${payload.partySize} guests`, undefined, 'NO_TABLE_AVAILABLE');
        table = free[0];
      }

      await assertTableIsFree(connection, {
        tableId: table.id,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
      });

      const [inserted] = await connection.execute(
        `INSERT INTO reservations (reference, user_id, contact_name, contact_email, contact_phone, type, table_id, reservation_date, start_time, end_time, party_size, occasion, requirements, menu_selection, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          placeholderReference(),
          actor?.id ?? null,
          contact.name,
          contact.email,
          contact.phone,
          payload.type,
          table.id,
          payload.date,
          payload.startTime,
          payload.endTime,
          payload.partySize,
          payload.occasion ?? null,
          payload.requirements ?? null,
          JSON.stringify(payload.menuSelection ?? []),
        ],
      );

      await connection.execute('UPDATE reservations SET reference = ? WHERE id = ?', [referenceForId(inserted.insertId), inserted.insertId]);
      return inserted.insertId;
    },
    uri,
  );

  return getReservationById(reservationId, uri);
}

export async function listReservations({ actor, filters }, uri) {
  const where = [];
  const params = [];

  if (actor.role !== 'admin') {
    where.push('r.user_id = ?');
    params.push(actor.id);
  }
  if (filters.date) {
    where.push('r.reservation_date = ?');
    params.push(filters.date);
  }
  if (filters.from) {
    where.push('r.reservation_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('r.reservation_date <= ?');
    params.push(filters.to);
  }
  if (filters.status) {
    where.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.type) {
    where.push('r.type = ?');
    params.push(filters.type);
  }
  if (filters.eventOnly) {
    where.push("r.type <> 'standard'");
  }
  if (filters.tableId) {
    where.push('r.table_id = ?');
    params.push(filters.tableId);
  }
  if (filters.search) {
    where.push('(r.reference LIKE ? OR r.occasion LIKE ? OR r.contact_email LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const direction = filters.order === 'desc' ? 'DESC' : 'ASC';

  const rows = await query(
    `${SELECT_WITH_TABLE} ${filter} ORDER BY r.reservation_date ${direction}, r.start_time ${direction} LIMIT ? OFFSET ?`,
    [...params, filters.limit, filters.offset],
    uri,
  );
  const totals = await query(`SELECT COUNT(*) AS total FROM reservations r ${filter}`, params, uri);

  const reservations = [];
  for (const row of rows) {
    const ids = menuSelectionIds(row);
    const dishes = ids.length ? await query('SELECT * FROM menu_items WHERE id IN (?)', [ids], uri) : [];
    reservations.push(toReservation(row, ids.map((id) => toMenuItem(dishes.find((dish) => dish.id === id))).filter(Boolean)));
  }

  return { total: Number(totals[0].total), limit: filters.limit, offset: filters.offset, reservations };
}

/** Tables a customer could actually be given for that slot — the availability query behind the form. */
export async function availableTables({ date, startTime, endTime, partySize = 2, area }, uri) {
  assertSlotIsOpen(date, startTime, endTime);

  const candidates = await loadTables({ partySize, area }, uri);
  if (candidates.length === 0) return { date, startTime, endTime, partySize, tables: [], closed: false };

  const booked = await query(
    `SELECT DISTINCT table_id FROM reservations
      WHERE reservation_date = ? AND status <> 'cancelled' AND start_time < ? AND end_time > ?`,
    [date, endTime, startTime],
    uri,
  );
  const taken = new Set(booked.map((row) => row.table_id));

  return {
    date,
    startTime,
    endTime,
    partySize,
    tables: candidates.filter((table) => !taken.has(table.id)),
  };
}

function assertMayChange(reservation, actor) {
  if (actor.role === 'admin') return;
  if (reservation.userId !== actor.id) throw ApiError.forbidden('You can only change your own bookings');
  if (reservation.status !== 'pending') {
    throw ApiError.conflict(`A ${reservation.status} booking can only be changed by the restaurant`);
  }
}

export async function updateReservation(id, changes, actor, uri) {
  const row = await loadReservationRow(id, uri);
  if (!row) throw ApiError.notFound('No booking with that id');

  const current = await getReservationById(id, uri);
  assertMayChange(current, actor);

  const date = changes.date ?? row.reservation_date;
  const startTime = changes.startTime ?? row.start_time.toString().slice(0, 5);
  const endTime = changes.endTime ?? row.end_time.toString().slice(0, 5);

  if (date !== row.reservation_date || startTime !== row.start_time.toString().slice(0, 5) || endTime !== row.end_time.toString().slice(0, 5)) {
    assertSlotIsOpen(date, startTime, endTime);
  }

  const partySize = changes.partySize ?? Number(row.party_size);
  if (partySize > config.restaurant.maxPartySize) {
    throw ApiError.unprocessable(`The largest booking we take online is ${config.restaurant.maxPartySize} guests`, [
      { field: 'partySize', max: config.restaurant.maxPartySize },
    ]);
  }

  if (changes.menuSelection) await assertMenuSelection(changes.menuSelection, uri);

  const sets = [];
  const params = [];
  const columnForField = {
    date: 'reservation_date',
    startTime: 'start_time',
    endTime: 'end_time',
    partySize: 'party_size',
    occasion: 'occasion',
    requirements: 'requirements',
    menuSelection: 'menu_selection',
  };

  for (const [field, column] of Object.entries(columnForField)) {
    if (!(field in changes)) continue;
    const value = changes[field];
    sets.push(`${column} = ?`);
    params.push(field === 'menuSelection' ? JSON.stringify(value ?? []) : value);
  }

  let tableId = row.table_id;
  if ('tableId' in changes) {
    if (changes.tableId === null) {
      tableId = null;
    } else {
      const [found] = await getPool(uri).query('SELECT * FROM restaurant_tables WHERE id = ?', [changes.tableId]);
      if (found.length === 0) throw ApiError.unprocessable('That table does not exist', [{ field: 'tableId' }]);
      if (found[0].seats < partySize) {
        throw ApiError.unprocessable(`${found[0].label} seats ${found[0].seats}, your party is ${partySize}`, [{ field: 'tableId' }]);
      }
      tableId = found[0].id;
    }
    sets.push('table_id = ?');
    params.push(tableId);
  }

  if (sets.length === 0) throw ApiError.badRequest('No changes were sent');

  await withTransaction(
    async (connection) => {
      if (tableId !== null) {
        await assertTableIsFree(connection, { tableId, date, startTime, endTime, excludeId: id });
      }
      await connection.execute(`UPDATE reservations SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    },
    uri,
  );

  return getReservationById(id, uri);
}

export async function changeReservationStatus(id, status, actor, uri) {
  const row = await loadReservationRow(id, uri);
  if (!row) throw ApiError.notFound('No booking with that id');

  if (actor.role !== 'admin') {
    if (row.user_id !== actor.id) throw ApiError.forbidden('You can only change your own bookings');
    if (status !== 'cancelled') throw ApiError.forbidden('Only the restaurant can approve or complete a booking');
    if (!RESERVATION_STATUS_FLOW[row.status]?.includes(status)) {
      throw ApiError.conflict(`A ${row.status} booking can no longer be cancelled`);
    }
  } else if (!RESERVATION_STATUS_FLOW[row.status]?.includes(status)) {
    throw ApiError.conflict(`A booking cannot go from ${row.status} to ${status}`, {
      from: row.status,
      allowed: RESERVATION_STATUS_FLOW[row.status],
    });
  }

  await execute('UPDATE reservations SET status = ? WHERE id = ?', [status, id], uri);
  return getReservationById(id, uri);
}

export async function deleteReservation(id, actor, uri) {
  const row = await loadReservationRow(id, uri);
  if (!row) throw ApiError.notFound('No booking with that id');
  if (actor.role !== 'admin') throw ApiError.forbidden('Only the restaurant can delete a booking; customers cancel them');

  await execute('DELETE FROM reservations WHERE id = ?', [id], uri);
  return { deleted: true, id, reference: row.reference };
}
