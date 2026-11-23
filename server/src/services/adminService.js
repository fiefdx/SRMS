/**
 * Admin analytics: the numbers behind the dashboard, worked out with SQL instead of pulling tables into
 * JavaScript. Cancelled orders are excluded from revenue and popularity, and the daily series is filled
 * with empty days so a chart has one point per day.
 */
import { query } from '../db/pool.js';

const money = (value) => Number(Number(value ?? 0).toFixed(2));

function dateText(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export async function revenueSeries({ days = 7 }, uri) {
  const since = dateText(daysAgo(days - 1));

  const rows = await query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS orders, SUM(total) AS revenue, AVG(total) AS average_order
       FROM orders
      WHERE created_at >= ? AND status <> 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY day`,
    [since],
    uri,
  );

  const byDay = new Map(rows.map((row) => [String(row.day), row]));
  const series = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = dateText(daysAgo(offset));
    const row = byDay.get(day);
    series.push({
      day,
      orders: Number(row?.orders ?? 0),
      revenue: money(row?.revenue ?? 0),
      averageOrder: money(row?.average_order ?? 0),
    });
  }

  return { days, since, series };
}

export async function popularItems({ limit = 5, days = 30 }, uri) {
  const since = dateText(daysAgo(days));
  const rows = await query(
    `SELECT oi.name, SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'cancelled' AND o.created_at >= ?
      GROUP BY oi.name
      ORDER BY quantity DESC, revenue DESC
      LIMIT ?`,
    [since, limit],
    uri,
  );

  return rows.map((row) => ({ name: row.name, quantity: Number(row.quantity), revenue: money(row.revenue) }));
}

export async function statusBreakdown(uri) {
  const rows = await query(
    `SELECT status, COUNT(*) AS orders, SUM(total) AS revenue
       FROM orders
      GROUP BY status
      ORDER BY orders DESC`,
    [],
    uri,
  );

  return rows.map((row) => ({ status: row.status, orders: Number(row.orders), revenue: money(row.revenue) }));
}

export async function reservationStats(uri) {
  const today = dateText(new Date());

  const [counts] = await query(
    `SELECT COUNT(*) AS total,
            SUM(reservation_date = ?) AS today,
            SUM(reservation_date >= ? AND status = 'pending') AS upcoming_pending,
            SUM(status = 'pending') AS pending
       FROM reservations
      WHERE status <> 'cancelled'`,
    [today, today],
    uri,
  );

  const perType = await query(
    "SELECT type, COUNT(*) AS bookings FROM reservations WHERE status <> 'cancelled' GROUP BY type ORDER BY bookings DESC",
    [],
    uri,
  );

  const tablesInUse = await query(
    `SELECT t.label, COUNT(r.id) AS bookings
       FROM restaurant_tables t
       LEFT JOIN reservations r ON r.table_id = t.id AND r.reservation_date = ? AND r.status <> 'cancelled'
      GROUP BY t.id, t.label
      ORDER BY bookings DESC, t.label`,
    [today],
    uri,
  );

  return {
    total: Number(counts.total),
    today: Number(counts.today ?? 0),
    pending: Number(counts.pending ?? 0),
    upcomingPending: Number(counts.upcoming_pending ?? 0),
    byType: perType.map((row) => ({ type: row.type, bookings: Number(row.bookings) })),
    tablesToday: tablesInUse.map((row) => ({ label: row.label, bookings: Number(row.bookings) })),
  };
}

export async function feedbackStats(uri) {
  const [summary] = await query(
    'SELECT COUNT(*) AS reviews, AVG(rating) AS average_rating, SUM(rating >= 4) AS positive, SUM(rating <= 2) AS negative FROM feedback',
    [],
    uri,
  );

  const bySentiment = await query(
    'SELECT COALESCE(sentiment, "not analysed") AS sentiment, COUNT(*) AS reviews FROM feedback GROUP BY sentiment ORDER BY reviews DESC',
    [],
    uri,
  );

  return {
    reviews: Number(summary.reviews),
    averageRating: Number(Number(summary.average_rating ?? 0).toFixed(2)),
    positive: Number(summary.positive ?? 0),
    negative: Number(summary.negative ?? 0),
    bySentiment: bySentiment.map((row) => ({ sentiment: row.sentiment, reviews: Number(row.reviews) })),
  };
}

/** Everything the dashboard page needs in one call. */
export async function dashboard({ days = 7, popularLimit = 5 } = {}, uri) {
  const [series, popular, statuses, reservations, feedback, orderTotals] = await Promise.all([
    revenueSeries({ days }, uri),
    popularItems({ limit: popularLimit }, uri),
    statusBreakdown(uri),
    reservationStats(uri),
    feedbackStats(uri),
    query(
      `SELECT COUNT(*) AS orders,
              SUM(status <> 'cancelled') AS active_orders,
              SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END) AS revenue,
              AVG(CASE WHEN status <> 'cancelled' THEN total END) AS average_order,
              SUM(status = 'pending') AS awaiting_kitchen
         FROM orders`,
      [],
      uri,
    ),
  ]);

  const totals = orderTotals[0];

  return {
    generatedAt: new Date().toISOString(),
    periodDays: days,
    orders: {
      total: Number(totals.orders),
      active: Number(totals.active_orders ?? 0),
      awaitingKitchen: Number(totals.awaiting_kitchen ?? 0),
      revenue: money(totals.revenue),
      averageOrder: money(totals.average_order),
    },
    revenueSeries: series.series,
    popularItems: popular,
    statusBreakdown: statuses,
    reservations,
    feedback,
  };
}

export async function listFeedback({ sentiment, rating, limit = 50, offset = 0 }, uri) {
  const where = [];
  const params = [];

  if (sentiment === 'not analysed') where.push('f.sentiment IS NULL');
  else if (sentiment) {
    where.push('f.sentiment = ?');
    params.push(sentiment);
  }
  if (rating) {
    where.push('f.rating = ?');
    params.push(rating);
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT f.*, o.reference AS order_reference, u.name AS customer_name
       FROM feedback f
       LEFT JOIN orders o ON o.id = f.order_id
       LEFT JOIN users u ON u.id = f.user_id
       ${filter}
      ORDER BY f.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
    uri,
  );
  const totals = await query(`SELECT COUNT(*) AS total FROM feedback f ${filter}`, params, uri);

  return {
    total: Number(totals[0].total),
    limit,
    offset,
    feedback: rows.map((row) => ({
      id: row.id,
      orderReference: row.order_reference ?? null,
      customerName: row.customer_name ?? null,
      rating: row.rating === null ? null : Number(row.rating),
      comment: row.comment,
      sentiment: row.sentiment ?? null,
      createdAt: row.created_at,
    })),
  };
}
