/**
 * /api/reservations — booking a table.
 * `/availability` is declared before `/:reservationId`, and it stays public because the booking form
 * shows free tables before anybody signs in.
 */
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  availabilityQuerySchema,
  createReservationSchema,
  listReservationsQuerySchema,
  reservationIdParamSchema,
  reservationStatusSchema,
  updateReservationSchema,
} from '../validation/reservationSchemas.js';
import {
  browseReservations,
  changeReservationState,
  checkAvailability,
  editReservation,
  placeBooking,
  readReservation,
  removeReservation,
} from '../controllers/reservationController.js';

const router = Router();

router.get('/availability', validate(availabilityQuerySchema, 'query'), asyncHandler(checkAvailability));

router.post('/', optionalAuthenticate, validate(createReservationSchema), asyncHandler(placeBooking));

router.get('/', authenticate, validate(listReservationsQuerySchema, 'query'), asyncHandler(browseReservations));

router.get('/:reservationId', authenticate, validate(reservationIdParamSchema, 'params'), asyncHandler(readReservation));

router.patch(
  '/:reservationId',
  authenticate,
  validate(reservationIdParamSchema, 'params'),
  validate(updateReservationSchema),
  asyncHandler(editReservation),
);

router.patch(
  '/:reservationId/status',
  authenticate,
  validate(reservationIdParamSchema, 'params'),
  validate(reservationStatusSchema),
  asyncHandler(changeReservationState),
);

router.delete(
  '/:reservationId',
  authenticate,
  validate(reservationIdParamSchema, 'params'),
  asyncHandler(removeReservation),
);

export default router;
