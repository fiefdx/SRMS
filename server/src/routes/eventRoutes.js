/**
 * /api/events — the event side of the same table (birthday, corporate and group bookings).
 * A customer requests an event here; the restaurant reviews it in the reservations view. Keeping this as
 * a separate router means the frontend has an obvious endpoint for the "book an event" form while the
 * rules (availability, opening hours, who may change what) are still written once in reservationService.
 */
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createEventSchema, eventIdParamSchema, listReservationsQuerySchema, reservationStatusSchema, updateReservationSchema } from '../validation/reservationSchemas.js';
import { browseEvents, changeReservationState, editReservation, placeBooking, readReservation } from '../controllers/reservationController.js';

const router = Router();

/* The service and controller speak one language: the /api/events routes call the parameter eventId, so
   it is copied to the reservationId the shared handlers expect. */
function asReservationId(req, res, next) {
  req.valid = { ...req.valid, params: { ...req.valid.params, reservationId: req.valid.params.eventId } };
  return next();
}

router.post('/', optionalAuthenticate, validate(createEventSchema), asyncHandler(placeBooking));
router.get('/', authenticate, validate(listReservationsQuerySchema, 'query'), asyncHandler(browseEvents));
router.get('/:eventId', authenticate, validate(eventIdParamSchema, 'params'), asReservationId, asyncHandler(readReservation));

router.patch(
  '/:eventId',
  authenticate,
  validate(eventIdParamSchema, 'params'),
  asReservationId,
  validate(updateReservationSchema),
  asyncHandler(editReservation),
);

router.patch(
  '/:eventId/status',
  authenticate,
  validate(eventIdParamSchema, 'params'),
  asReservationId,
  validate(reservationStatusSchema),
  asyncHandler(changeReservationState),
);

export default router;
