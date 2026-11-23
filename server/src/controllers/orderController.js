/**
 * Order endpoints.
 *
 *   POST   /api/orders                        signed-in customer or guest (contact details required)
 *   GET    /api/orders                        customers see their own, admins see all
 *   GET    /api/orders/reference/:reference   the receipt lookup: sign in, or give the order's email
 *   GET    /api/orders/:orderId               owner or admin
 *   PATCH  /api/orders/:orderId/items         owner (while pending) or admin
 *   PATCH  /api/orders/:orderId/status        admin moves it along the flow; a customer may cancel
 *   POST   /api/orders/:orderId/feedback      owner or admin, one review per order
 */
import ApiError from '../utils/ApiError.js';
import {
  addOrderFeedback,
  assertCanView,
  changeOrderStatus,
  createOrder,
  getOrderByReference,
  getOrderById,
  listOrders,
  replaceOrderItems,
} from '../services/orderService.js';

export async function placeOrder(req, res) {
  const order = await createOrder({ payload: req.valid.body, actor: req.user ?? null });
  res.status(201).json({ order });
}

export async function browseOrders(req, res) {
  res.json(await listOrders({ actor: req.user, filters: req.valid.query }));
}

export async function readOrder(req, res) {
  const order = await getOrderById(req.valid.params.orderId);
  if (!order) throw ApiError.notFound('No order with that id');
  assertCanView(order, req.user);
  res.json({ order });
}

/**
 * Reading an order from the receipt. An account holder is recognised from the token; a **guest order**
 * (no account attached) can additionally be read by presenting the email it was placed with — the
 * reference plus the email is the guest's credential. Orders that belong to an account are never
 * released by an email match alone.
 */
export async function readOrderByReference(req, res) {
  const order = await getOrderByReference(req.valid.params.reference);
  if (!order) throw ApiError.notFound('No order with that reference');

  const isOwnerOrAdmin = req.user && (req.user.role === 'admin' || order.userId === req.user.id);
  const emailMatches =
    order.userId === null && Boolean(order.contact?.email) && order.contact.email === req.valid.query.email;

  if (!isOwnerOrAdmin && !emailMatches) {
    throw ApiError.forbidden('Sign in, or provide the email address this order was placed with');
  }

  res.json({ order });
}

export async function changeOrderItems(req, res) {
  res.json({ order: await replaceOrderItems(req.valid.params.orderId, req.valid.body.items, req.user) });
}

export async function changeOrderState(req, res) {
  const { status, note } = req.valid.body;
  res.json({ order: await changeOrderStatus(req.valid.params.orderId, status, note, req.user) });
}

export async function reviewOrder(req, res) {
  res.status(201).json({ feedback: await addOrderFeedback(req.valid.params.orderId, req.valid.body, req.user) });
}
