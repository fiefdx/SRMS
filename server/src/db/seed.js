/**
 * Demo data loader (used by `npm run seed` and by the integration tests).
 *
 * Order totals are recalculated here with src/services/pricing.js instead of being copied from the
 * frontend, and menu popularity is derived from the seeded order lines with SQL — so "popular dishes"
 * in the admin dashboard and the AI assistant both come from real data rather than a hard-coded flag.
 */
import bcrypt from 'bcryptjs';
import { execute, query, getPool, closePools, defaultUri } from './pool.js';
import {
  MENU_SEED,
  TABLE_SEED,
  USER_SEED,
  ORDER_SEED,
  RESERVATION_SEED,
  FEEDBACK_SEED,
  DEMO_PASSWORD,
} from './seedData.js';
import { calculateTotals } from '../services/pricing.js';

const TABLES_TO_CLEAR = [
  'feedback',
  'order_items',
  'orders',
  'reservations',
  'restaurant_tables',
  'menu_items',
  'users',
];

const pad = (n) => String(n).padStart(2, '0');

function dateInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function asDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function asDateTime(date) {
  return `${asDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export async function clearDatabase({ uri = defaultUri() } = {}) {
  const pool = getPool(uri);
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES_TO_CLEAR) await pool.query(`TRUNCATE TABLE ${table}`);
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function seedDatabase({ uri = defaultUri(), password = DEMO_PASSWORD } = {}) {
  await runMigrationIfNeeded(uri);
  await clearDatabase({ uri });

  const passwordHash = await bcrypt.hash(password, 10);

  /* ---- users ---- */
  const userIds = new Map();
  for (const user of USER_SEED) {
    const result = await execute(
      `INSERT INTO users (name, email, password_hash, role, phone, address, dietary_tags, favourites)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.name,
        user.email,
        passwordHash,
        user.role,
        user.phone ?? null,
        user.address ?? null,
        JSON.stringify(user.dietaryTags ?? []),
        JSON.stringify(user.favourites ?? []),
      ],
      uri,
    );
    userIds.set(user.email, result.insertId);
  }

  /* ---- menu ---- */
  const menuByName = new Map();
  for (const item of MENU_SEED) {
    const result = await execute(
      `INSERT INTO menu_items (name, category, description, ingredients, allergens, dietary_tags, price, available, today_special, emoji)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.name,
        item.category,
        item.description,
        JSON.stringify(item.ingredients),
        JSON.stringify(item.allergens),
        JSON.stringify(item.dietaryTags),
        item.price,
        item.available ? 1 : 0,
        item.todaySpecial ? 1 : 0,
        item.emoji ?? null,
      ],
      uri,
    );
    menuByName.set(item.name, { id: result.insertId, price: item.price });
  }

  /* ---- restaurant tables ---- */
  const tableByLabel = new Map();
  for (const table of TABLE_SEED) {
    const result = await execute(
      'INSERT INTO restaurant_tables (label, seats, area) VALUES (?, ?, ?)',
      [table.label, table.seats, table.area],
      uri,
    );
    tableByLabel.set(table.label, result.insertId);
  }

  /* ---- orders + line items ---- */
  const orderIds = new Map();
  for (const order of ORDER_SEED) {
    const lines = order.lines.map((line) => {
      const item = menuByName.get(line.name);
      if (!item) throw new Error(`Seed order ${order.reference} references an unknown menu item: ${line.name}`);
      return { menuItemId: item.id, name: line.name, unitPrice: item.price, quantity: line.quantity };
    });

    const totals = calculateTotals(lines, order.fulfilment);
    const placedAt = dateInDays(order.daysAgo);

    const result = await execute(
      `INSERT INTO orders (reference, user_id, contact_name, contact_email, contact_phone, status, fulfilment, fulfilment_details, notes, subtotal, delivery_fee, tax, total, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.reference,
        order.userEmail ? userIds.get(order.userEmail) : null,
        order.contact?.name ?? null,
        order.contact?.email ?? null,
        order.contact?.phone ?? null,
        order.status,
        order.fulfilment,
        JSON.stringify({
          address: order.fulfilment === 'delivery' ? '48 Harbour Street' : null,
          requestedAt: asDateTime(placedAt),
        }),
        order.notes || null,
        totals.subtotal,
        totals.deliveryFee,
        totals.tax,
        totals.total,
        asDateTime(placedAt),
        asDateTime(placedAt),
      ],
      uri,
    );
    orderIds.set(order.reference, result.insertId);

    for (const line of lines) {
      await execute(
        'INSERT INTO order_items (order_id, menu_item_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)',
        [result.insertId, line.menuItemId, line.name, line.unitPrice, line.quantity],
        uri,
      );
    }
  }

  /* ---- reservations (standard bookings and event requests) ---- */
  for (const reservation of RESERVATION_SEED) {
    const day = dateInDays(reservation.reservationInDays);
    await execute(
      `INSERT INTO reservations (reference, user_id, contact_name, contact_email, contact_phone, type, table_id, reservation_date, start_time, end_time, party_size, occasion, requirements, menu_selection, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reservation.reference,
        reservation.userEmail ? userIds.get(reservation.userEmail) : null,
        reservation.contact?.name ?? null,
        reservation.contact?.email ?? null,
        reservation.contact?.phone ?? null,
        reservation.type,
        tableByLabel.get(reservation.tableLabel) ?? null,
        asDate(day),
        reservation.startTime,
        reservation.endTime,
        reservation.partySize,
        reservation.occasion ?? null,
        reservation.requirements ?? null,
        JSON.stringify((reservation.menuSelection ?? []).map((name) => menuByName.get(name)?.id).filter(Boolean)),
        reservation.status,
      ],
      uri,
    );
  }

  /* ---- customer feedback (sentiment is filled by the AI feedback analysis feature) ---- */
  for (const entry of FEEDBACK_SEED) {
    const orderId = orderIds.get(entry.orderReference);
    const order = ORDER_SEED.find((o) => o.reference === entry.orderReference);
    await execute(
      'INSERT INTO feedback (order_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [orderId, order.userEmail ? userIds.get(order.userEmail) : null, entry.rating, entry.comment],
      uri,
    );
  }

  /* ---- popularity derived from the seeded orders ---- */
  await execute(
    `UPDATE menu_items mi
       SET mi.popularity = COALESCE((
         SELECT SUM(oi.quantity)
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.menu_item_id = mi.id AND o.status <> 'cancelled'
       ), 0)`,
    [],
    uri,
  );

  return summaryCounts(uri);
}

async function runMigrationIfNeeded(uri) {
  const { database } = { database: new URL(uri).pathname.replace(/^\//, '') };
  const pool = getPool(uri);
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [database],
  );
  if (Number(rows[0].total) === 0) {
    const { runMigration } = await import('./migrate.js');
    await runMigration({ uri });
  }
}

export async function summaryCounts(uri = defaultUri()) {
  const counts = {};
  for (const table of [...TABLES_TO_CLEAR].reverse()) {
    const rows = await query(`SELECT COUNT(*) AS total FROM ${table}`, [], uri);
    counts[table] = Number(rows[0].total);
  }
  return counts;
}

export { closePools };
