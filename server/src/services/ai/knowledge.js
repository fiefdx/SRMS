/**
 * Facts the assistant is allowed to quote, read from the database on every question. Nothing here is
 * hard-coded: if the kitchen switches a dish off, changes today's special or somebody books a table, the
 * next answer reflects it.
 */
import config from '../../config/env.js';
import { query, queryOne } from '../../db/pool.js';
import { DELIVERY_FEE, FREE_DELIVERY_FROM, TAX_RATE } from '../pricing.js';
import { popularItems, feedbackStats } from '../adminService.js';
import { availableTables } from '../reservationService.js';
import { toOrder } from '../../mappers/order.js';
import { toReservation } from '../../mappers/reservation.js';

const pad = (n) => String(n).padStart(2, '0');

function dateInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekdayOf(dateText) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${dateText}T12:00:00`).getDay()
  ];
}

export function restaurantFacts() {
  return {
    name: config.restaurant.name,
    openingHours: config.restaurant.openingHours,
    maxPartySize: config.restaurant.maxPartySize,
    taxPercent: `${(TAX_RATE * 100).toFixed(0)}%`,
    deliveryFee: DELIVERY_FEE,
    freeDeliveryFrom: FREE_DELIVERY_FROM,
  };
}

export async function todaysSpecial(uri) {
  const row = await queryOne(
    'SELECT name, price, description FROM menu_items WHERE today_special = 1 AND available = 1 LIMIT 1',
    [],
    uri,
  );
  return row ? { name: row.name, price: Number(row.price), description: row.description } : null;
}

export async function priceRange(uri) {
  const row = await queryOne(
    'SELECT MIN(price) AS cheapest, MAX(price) AS dearest, COUNT(*) AS dishes FROM menu_items WHERE available = 1',
    [],
    uri,
  );
  return { cheapest: Number(row.cheapest), dearest: Number(row.dearest), dishes: Number(row.dishes) };
}

export async function dishesMatching({ dietary, maxPrice, category, limit = 4 } = {}, uri) {
  const where = ['available = 1'];
  const params = [];

  if (dietary) {
    where.push('JSON_CONTAINS(dietary_tags, JSON_QUOTE(?))');
    params.push(dietary);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (maxPrice) {
    where.push('price <= ?');
    params.push(maxPrice);
  }

  const rows = await query(
    `SELECT name, category, price, dietary_tags FROM menu_items WHERE ${where.join(' AND ')}
      ORDER BY popularity DESC, price LIMIT ?`,
    [...params, limit],
    uri,
  );

  return rows.map((row) => ({
    name: row.name,
    category: row.category,
    price: Number(row.price),
    dietaryTags: Array.isArray(row.dietary_tags) ? row.dietary_tags : JSON.parse(row.dietary_tags ?? '[]'),
  }));
}

export async function findDish(nameLike, uri) {
  const row = await queryOne(
    'SELECT name, category, price, description, available, dietary_tags FROM menu_items WHERE name LIKE ? ORDER BY name LIMIT 1',
    [`%${nameLike}%`],
    uri,
  );
  if (!row) return null;
  return {
    name: row.name,
    category: row.category,
    price: Number(row.price),
    description: row.description,
    available: Boolean(Number(row.available)),
  };
}

/** The first slot in the next two weeks where a table of the right size is free. */
export async function nextFreeTable(partySize = 2, uri) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = dateInDays(offset);
    const entry = config.restaurant.openingHours.find((hours) => hours.day === weekdayOf(date));
    if (!entry || entry.open === null) continue;

    for (const start of ['19:00', '18:00', '20:00', entry.open]) {
      const endMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + 90;
      const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${pad(endMinutes % 60)}`;
      if (end > entry.close) continue;

      try {
        const availability = await availableTables({ date, startTime: start, endTime: end, partySize }, uri);
        if (availability.tables.length > 0) {
          return { date, weekday: weekdayOf(date), startTime: start, endTime: end, table: availability.tables[0] };
        }
      } catch {
        /* a slot outside the opening hours simply is not offered */
      }
    }
  }
  return null;
}

export async function myLatestOrder(userId, uri) {
  const row = await queryOne("SELECT * FROM orders WHERE user_id = ? AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1", [userId], uri);
  if (!row) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [row.id], uri);
  return toOrder(row, items);
}

export async function myOrderReference(userId, reference, uri) {
  const row = await queryOne('SELECT * FROM orders WHERE user_id = ? AND reference = ?', [userId, reference], uri);
  if (!row) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [row.id], uri);
  return toOrder(row, items);
}

export async function myUpcomingReservation(userId, uri) {
  const row = await queryOne(
    `SELECT r.*, t.label AS table_label, t.seats AS table_seats, t.area AS table_area
       FROM reservations r LEFT JOIN restaurant_tables t ON t.id = r.table_id
      WHERE r.user_id = ? AND r.status <> 'cancelled' AND r.reservation_date >= CURDATE()
      ORDER BY r.reservation_date, r.start_time LIMIT 1`,
    [userId],
    uri,
  );
  return row ? toReservation(row) : null;
}

export { popularItems, feedbackStats };
