/**
 * /api/orders — placing and tracking orders.
 * `/reference/:reference` is declared before `/:orderId` so the word "reference" is not read as an id.
 */
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  createOrderSchema,
  guestLookupQuerySchema,
  orderFeedbackSchema,
  orderIdParamSchema,
  orderReferenceParamSchema,
  orderStatusSchema,
  listOrdersQuerySchema,
  replaceOrderItemsSchema,
} from '../validation/orderSchemas.js';
import {
  browseOrders,
  changeOrderItems,
  changeOrderState,
  placeOrder,
  readOrder,
  readOrderByReference,
  reviewOrder,
} from '../controllers/orderController.js';

const router = Router();

router.post('/', optionalAuthenticate, validate(createOrderSchema), asyncHandler(placeOrder));

router.get(
  '/reference/:reference',
  optionalAuthenticate,
  validate(orderReferenceParamSchema, 'params'),
  validate(guestLookupQuerySchema, 'query'),
  asyncHandler(readOrderByReference),
);

router.get('/', authenticate, validate(listOrdersQuerySchema, 'query'), asyncHandler(browseOrders));

router.get('/:orderId', authenticate, validate(orderIdParamSchema, 'params'), asyncHandler(readOrder));

router.patch(
  '/:orderId/items',
  authenticate,
  validate(orderIdParamSchema, 'params'),
  validate(replaceOrderItemsSchema),
  asyncHandler(changeOrderItems),
);

router.patch(
  '/:orderId/status',
  authenticate,
  validate(orderIdParamSchema, 'params'),
  validate(orderStatusSchema),
  asyncHandler(changeOrderState),
);

router.post(
  '/:orderId/feedback',
  authenticate,
  validate(orderIdParamSchema, 'params'),
  validate(orderFeedbackSchema),
  asyncHandler(reviewOrder),
);

export default router;
