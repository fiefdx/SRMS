/**
 * Reservation and event validation. Events are reservations with a type (birthday, corporate, group)
 * rather than a second table, so the availability rules apply to both.
 */
import { z } from 'zod';
import { contactSchema } from './orderSchemas.js';

export const RESERVATION_TYPES = ['standard', 'birthday', 'corporate', 'group'];
export const RESERVATION_STATUSES = ['pending', 'approved', 'cancelled', 'completed'];
export const TABLE_AREAS = ['main', 'window', 'group'];

const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must look like 2026-05-01');
const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must look like 19:00');

const reservationFields = {
  date,
  startTime: time,
  endTime: time,
  partySize: z.coerce.number().int().min(1, 'A booking needs at least one guest').max(40),
  tableId: z.coerce.number().int().positive().optional(),
  area: z.enum(TABLE_AREAS).optional(),
  occasion: z.string().trim().max(120).optional(),
  requirements: z.string().trim().max(500).optional(),
  menuSelection: z.array(z.coerce.number().int().positive()).max(20).optional(),
  contact: contactSchema.optional(),
};

function rejectBackwardsSlot(schema) {
  return schema.superRefine((data, ctx) => {
    if (data.endTime <= data.startTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'The end time must be after the start time' });
    }
  });
}

export const createReservationSchema = rejectBackwardsSlot(
  z.object({ type: z.enum(RESERVATION_TYPES).default('standard'), ...reservationFields }).strict(),
).superRefine((data, ctx) => {
  if (data.type !== 'standard' && !data.occasion) {
    ctx.addIssue({ code: 'custom', path: ['occasion'], message: 'An event booking needs an occasion' });
  }
});

/** Booking request for an event: same rules, but the event fields are mandatory. */
export const createEventSchema = rejectBackwardsSlot(
  z
    .object({
      type: z.enum(['birthday', 'corporate', 'group']),
      ...reservationFields,
      occasion: z.string().trim().min(3, 'Tell us what the event is').max(120),
    })
    .strict(),
);

export const updateReservationSchema = z
  .object({
    date: date.optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    partySize: z.coerce.number().int().min(1).max(40).optional(),
    tableId: z.coerce.number().int().positive().nullable().optional(),
    area: z.enum(TABLE_AREAS).optional(),
    occasion: z.string().trim().max(120).optional(),
    requirements: z.string().trim().max(500).optional(),
    menuSelection: z.array(z.coerce.number().int().positive()).max(20).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'No changes were sent' });

export const reservationStatusSchema = z
  .object({
    status: z.enum(RESERVATION_STATUSES, { message: `status must be one of: ${RESERVATION_STATUSES.join(', ')}` }),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const reservationIdParamSchema = z.object({
  reservationId: z.coerce.number().int().positive('Reservation id must be a positive number'),
});

/** Same rule, for the /api/events routes where the parameter is called eventId. */
export const eventIdParamSchema = z.object({
  eventId: z.coerce.number().int().positive('Event id must be a positive number'),
});

export const listReservationsQuerySchema = z
  .object({
    date: date.optional(),
    from: date.optional(),
    to: date.optional(),
    status: z.enum(RESERVATION_STATUSES).optional(),
    type: z.enum(RESERVATION_TYPES).optional(),
    tableId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().max(60).optional(),
    order: z.enum(['asc', 'desc']).default('asc'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const availabilityQuerySchema = z
  .object({
    date,
    startTime: time,
    endTime: time,
    partySize: z.coerce.number().int().min(1).max(40).default(2),
    area: z.enum(TABLE_AREAS).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endTime <= data.startTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'The end time must be after the start time' });
    }
  });
