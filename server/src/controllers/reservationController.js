/**
 * Reservation and event endpoints. Customers see their own bookings, the restaurant (admin) sees all of
 * them, and the availability query is public because the booking form needs it before signing in.
 */
import ApiError from '../utils/ApiError.js';
import {
  availableTables,
  changeReservationStatus,
  createReservation,
  deleteReservation,
  getReservationById,
  listReservations,
  updateReservation,
} from '../services/reservationService.js';

function assertCanView(reservation, actor) {
  if (!actor) throw ApiError.unauthorized('Sign in to read this booking');
  if (actor.role === 'admin' || reservation.userId === actor.id) return;
  throw ApiError.forbidden('You can only read your own bookings');
}

export async function placeBooking(req, res) {
  const reservation = await createReservation({ payload: req.valid.body, actor: req.user ?? null });
  res.status(201).json({ reservation });
}

export async function browseReservations(req, res) {
  res.json(await listReservations({ actor: req.user, filters: req.valid.query }));
}

/** Events are bookings with a type, so this is the same list restricted to them. */
export async function browseEvents(req, res) {
  res.json(await listReservations({ actor: req.user, filters: { ...req.valid.query, eventOnly: true } }));
}

export async function checkAvailability(req, res) {
  res.json(await availableTables(req.valid.query));
}

export async function readReservation(req, res) {
  const reservation = await getReservationById(req.valid.params.reservationId);
  if (!reservation) throw ApiError.notFound('No booking with that id');
  assertCanView(reservation, req.user);
  res.json({ reservation });
}

export async function editReservation(req, res) {
  const reservation = await updateReservation(req.valid.params.reservationId, req.valid.body, req.user);
  res.json({ reservation });
}

export async function changeReservationState(req, res) {
  const reservation = await changeReservationStatus(req.valid.params.reservationId, req.valid.body.status, req.user);
  res.json({ reservation });
}

export async function removeReservation(req, res) {
  res.json(await deleteReservation(req.valid.params.reservationId, req.user));
}
