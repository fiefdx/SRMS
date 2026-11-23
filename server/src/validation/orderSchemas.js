/**
 * Order validation. Prices are never part of the request: the client sends dish ids and quantities and
 * the API works out the money (see services/orderService.js), so a edited cart total in devtools has no
 * effect.
 */
import { z } from 'zod';

export const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
export const FULFILMENT_TYPES = ['delivery', 'pickup'];

const orderLine = z
  .object({
    menuItemId: z.coerce.number().int().positive('menuItemId must be a positive number'),
    quantity: z.coerce.number().int().min(1, 'Each line needs at least one item').max(99, 'Quantity is too large'),
  })
  .strict();

const cartLines = z.array(orderLine).min(1, 'Your cart is empty').max(50, 'Too many lines in one order');

const contact = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(80),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .transform((email) => email.toLowerCase()),
    phone: z.string().trim().max(30).optional(),
  })
  .strict();

/** A time the customer would like, as written on the checkout form ("2026-05-01 19:00"). */
const requestedTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/, 'requestedTime must look like 2026-05-01 19:00');

export const createOrderSchema = z
  .object({
    fulfilment: z.enum(FULFILMENT_TYPES),
    items: cartLines,
    contact: contact.optional(),
    deliveryAddress: z.string().trim().min(5, 'Enter a full delivery address').max(200).optional(),
    requestedTime: requestedTime.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.fulfilment === 'delivery' && !data.deliveryAddress) {
      ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'A delivery order needs an address' });
    }
  });

export const replaceOrderItemsSchema = z
  .object({ items: cartLines })
  .strict()
  .refine((data) => data.items.length > 0, { message: 'An order needs at least one item' });

export const orderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUSES, { message: `status must be one of: ${ORDER_STATUSES.join(', ')}` }),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const orderFeedbackSchema = z
  .object({
    rating: z.coerce.number().int().min(1, 'Rate from 1 to 5').max(5, 'Rate from 1 to 5'),
    comment: z.string().trim().min(3, 'Tell us what you thought').max(500),
  })
  .strict();

export const orderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive('Order id must be a positive number'),
});

export const orderReferenceParamSchema = z.object({
  reference: z.string().trim().regex(/^ORD-\d{1,6}$/, 'Order reference must look like ORD-1001'),
});

export const listOrdersQuerySchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    search: z.string().trim().max(60).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

/** Guest lookup: the reference plus the email the order was placed with. */
export const guestLookupQuerySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Enter the email the order was placed with')
      .transform((email) => email.toLowerCase()),
  })
  .strict();
