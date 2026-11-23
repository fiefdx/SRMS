/** Query rules for the admin endpoints. The ranges keep a report request from asking for a year of rows. */
import { z } from 'zod';

export const dashboardQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(90).default(7),
    popularLimit: z.coerce.number().int().min(1).max(20).default(5),
  })
  .strict();

export const revenueQuerySchema = z
  .object({ days: z.coerce.number().int().min(1).max(90).default(7) })
  .strict();

export const popularQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(20).default(5),
    days: z.coerce.number().int().min(1).max(365).default(30),
  })
  .strict();

export const feedbackQuerySchema = z
  .object({
    sentiment: z.enum(['positive', 'neutral', 'negative', 'not analysed']).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
