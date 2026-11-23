/**
 * Order management rules.
 *
 * The important idea: **the client sends dish ids and quantities, never prices.** The order lines and
 * the totals are built from the menu rows inside a transaction, so an edited cart total in devtools
 * cannot change what is charged, and a dish that went off the menu or was switched off by the kitchen is
 * refused before anything is written.
 *
 * Status changes follow the same flow the frontend shows (pending -> preparing -> ready -> delivered,
 * plus cancelled). An administrator may move an order along that flow; a customer may only cancel their
 * own order while it is still pending.
 */
import { randomUUID } from 'node:crypto';
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
import ApiError from '../utils/ApiError.js';
import { calculateTotals } from './pricing.js';
import { toOrder } from '../mappers/order.js';

export const ORDER_STATUS_FLOW = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/** The states in which the customer may still cancel their own order. */
export const CUSTOMER_CANCELLABLE_FROM = ['pending'];

/**
 * A short human reference (ORD-1001, ORD-1002 …). The id is only known after the INSERT, so the row is
 * created with a unique placeholder and updated inside the same transaction — no race, no gap.
 */
function referenceForId(id) {
  return `ORD-${id + 1000}`;
}

function placeholderReference() {
  return `tmp-${randomUUID().slice(0, 16)}`;
}

async function loadOrderRow(orderId, uri) {
  return queryOne('SELECT * FROM orders WHERE id = ?', [orderId], uri);
}

async function loadItems(orderIds, uri) {
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  if (ids.length === 0) return new Map();

  const rows = await query('SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id', [ids], uri);
  const byOrder = new Map();
  for (const row of rows) {
    if (!byOrder.has(row.order_id)) byOrder.set(row.order_id, []);
    byOrder.get(row.order_id).push(row);
  }
  return byOrder;
}

export async function getOrderById(orderId, uri) {
  const row = await loadOrderRow(orderId, uri);
  if (!row) return null;
  const items = await loadItems([row.id], uri);
  return toOrder(row, items.get(row.id) ?? []);
}

/** Same order, by the reference printed on the receipt. */
export async function getOrderByReference(reference, uri) {
  const row = await queryOne('SELECT * FROM orders WHERE reference = ?', [reference], uri);
  if (!row) return null;
  const items = await loadItems([row.id], uri);
  return toOrder(row, items.get(row.id) ?? []);
}

/**
 * Turn the cart into priced lines using the menu rows. Duplicate dish ids are merged, unknown or
 * unavailable dishes are reported per line so the frontend can show which one is the problem.
 */
async function buildLines(items, uri) {
  const merged = new Map();
  for (const item of items) {
    merged.set(item.menuItemId, (merged.get(item.menuItemId) ?? 0) + item.quantity);
  }

  const ids = [...merged.keys()];
  const rows = await query(`SELECT id, name, price, available FROM menu_items WHERE id IN (?)`, [ids], uri);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const problems = [];
  const lines = [];

  for (const [menuItemId, quantity] of merged) {
    const dish = byId.get(menuItemId);
    if (!dish) {
      problems.push({ field: 'items', value: menuItemId, message: 'is not on the menu' });
      continue;
    }
    if (!Number(dish.available)) {
      problems.push({ field: 'items', value: dish.name, message: 'is no longer available' });
      continue;
    }
    lines.push({ menuItemId: dish.id, name: dish.name, unitPrice: Number(dish.price), quantity });
  }

  if (problems.length) throw ApiError.unprocessable('Some items cannot be ordered right now', problems, 'CART_NOT_ORDERABLE');
  return lines;
}

export async function createOrder({ payload, actor }, uri) {
  if (!actor && !payload.contact?.email) {
    throw ApiError.unprocessable('A guest order needs a name and email so the receipt can be sent', [
      { field: 'contact.email' },
    ]);
  }

  const contact = {
    name: payload.contact?.name ?? actor?.name ?? null,
    email: payload.contact?.email ?? actor?.email ?? null,
    phone: payload.contact?.phone ?? actor?.phone ?? null,
  };

  const lines = await buildLines(payload.items, uri);
  const totals = calculateTotals(lines, payload.fulfilment);

  const details = {
    deliveryAddress: payload.fulfilment === 'delivery' ? payload.deliveryAddress : null,
    requestedTime: payload.requestedTime ?? null,
  };

  const orderId = await withTransaction(
    async (connection) => {
      const [inserted] = await connection.execute(
        `INSERT INTO orders (reference, user_id, contact_name, contact_email, contact_phone, status, fulfilment, fulfilment_details, notes, subtotal, delivery_fee, tax, total)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
        [
          placeholderReference(),
          actor?.id ?? null,
          contact.name,
          contact.email,
          contact.phone,
          payload.fulfilment,
          JSON.stringify(details),
          payload.notes ?? null,
          totals.subtotal,
          totals.deliveryFee,
          totals.tax,
          totals.total,
        ],
      );

      await connection.execute('UPDATE orders SET reference = ? WHERE id = ?', [referenceForId(inserted.insertId), inserted.insertId]);

      for (const line of lines) {
        await connection.execute(
          'INSERT INTO order_items (order_id, menu_item_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)',
          [inserted.insertId, line.menuItemId, line.name, line.unitPrice, line.quantity],
        );
      }

      return inserted.insertId;
    },
    uri,
  );

  return getOrderById(orderId, uri);
}

export async function listOrders({ actor, filters }, uri) {
  const where = [];
  const params = [];

  if (actor.role !== 'admin') {
    where.push('user_id = ?');
    params.push(actor.id);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.search) {
    where.push('(reference LIKE ? OR contact_email LIKE ? OR contact_name LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const direction = filters.order === 'asc' ? 'ASC' : 'DESC';

  const rows = await query(
    `SELECT * FROM orders ${filter} ORDER BY created_at ${direction}, id ${direction} LIMIT ? OFFSET ?`,
    [...params, filters.limit, filters.offset],
    uri,
  );
  const totals = await query(`SELECT COUNT(*) AS total FROM orders ${filter}`, params, uri);
  const itemsByOrder = await loadItems(rows.map((row) => row.id), uri);

  return {
    total: Number(totals[0].total),
    limit: filters.limit,
    offset: filters.offset,
    orders: rows.map((row) => toOrder(row, itemsByOrder.get(row.id) ?? [])),
  };
}

/** Customers see their own orders; administrators see all of them. */
export function assertCanView(order, actor) {
  if (!actor) throw ApiError.unauthorized('Sign in to read this order');
  if (actor.role === 'admin' || order.userId === actor.id) return;
  throw ApiError.forbidden('You can only read your own orders');
}

function assertMayChange(order, actor) {
  if (actor.role === 'admin') return;
  if (order.userId !== actor.id) throw ApiError.forbidden('You can only change your own orders');
}

export async function replaceOrderItems(orderId, items, actor, uri) {
  const row = await loadOrderRow(orderId, uri);
  if (!row) throw ApiError.notFound('No order with that id');

  const order = await getOrderById(orderId, uri);
  assertMayChange(order, actor);

  if (row.status !== 'pending') {
    throw ApiError.conflict(`A ${row.status} order can no longer be changed`, ORDER_STATUS_FLOW[row.status] ? { allowed: ORDER_STATUS_FLOW[row.status] } : undefined);
  }

  const lines = await buildLines(items, uri);
  const totals = calculateTotals(lines, row.fulfilment);

  await withTransaction(
    async (connection) => {
      await connection.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
      for (const line of lines) {
        await connection.execute(
          'INSERT INTO order_items (order_id, menu_item_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)',
          [orderId, line.menuItemId, line.name, line.unitPrice, line.quantity],
        );
      }
      await connection.execute('UPDATE orders SET subtotal = ?, delivery_fee = ?, tax = ?, total = ? WHERE id = ?', [
        totals.subtotal,
        totals.deliveryFee,
        totals.tax,
        totals.total,
        orderId,
      ]);
    },
    uri,
  );

  return getOrderById(orderId, uri);
}

export async function changeOrderStatus(orderId, status, note, actor, uri) {
  const row = await loadOrderRow(orderId, uri);
  if (!row) throw ApiError.notFound('No order with that id');

  if (actor.role !== 'admin') {
    /* Ownership first: answering 409 "a pending order cannot be cancelled" to somebody else's order
       would leak information about it. */
    if (row.user_id !== actor.id) throw ApiError.forbidden('You can only change your own orders');
    if (status !== 'cancelled') throw ApiError.forbidden('Only an administrator can move an order along the kitchen flow');
    if (!CUSTOMER_CANCELLABLE_FROM.includes(row.status)) {
      throw ApiError.conflict(`A ${row.status} order can no longer be cancelled`);
    }
  } else if (!ORDER_STATUS_FLOW[row.status]?.includes(status)) {
    throw ApiError.conflict(`An order cannot go from ${row.status} to ${status}`, {
      from: row.status,
      allowed: ORDER_STATUS_FLOW[row.status],
    }, 'INVALID_STATUS_TRANSITION');
  }

  if (note) {
    await execute('UPDATE orders SET notes = TRIM(CONCAT(COALESCE(notes, ?), ?)) WHERE id = ?', ['', `\n${note}`, orderId], uri);
  }

  await execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], uri);
  return getOrderById(orderId, uri);
}

export async function addOrderFeedback(orderId, { rating, comment }, actor, uri) {
  const row = await loadOrderRow(orderId, uri);
  if (!row) throw ApiError.notFound('No order with that id');

  if (actor.role !== 'admin' && row.user_id !== actor.id) throw ApiError.forbidden('You can only review your own orders');
  if (row.user_id === null && actor.role !== 'admin') {
    throw ApiError.forbidden('Guest orders cannot be reviewed without an account');
  }
  if (row.status === 'cancelled') throw ApiError.conflict('A cancelled order cannot be reviewed');

  const existing = await queryOne('SELECT id FROM feedback WHERE order_id = ?', [orderId], uri);
  if (existing) throw ApiError.conflict('This order has already been reviewed');

  const result = await execute('INSERT INTO feedback (order_id, user_id, rating, comment) VALUES (?, ?, ?, ?)', [
    orderId,
    row.user_id,
    rating,
    comment,
  ], uri);

  return { id: result.insertId, orderReference: row.reference, rating, comment, sentiment: null };
}
