/** Request rules for the AI endpoints. */
import { z } from 'zod';

export const askSchema = z
  .object({
    question: z.string().trim().min(2, 'Type a question').max(300, 'Keep the question under 300 characters'),
  })
  .strict();

export const analyseFeedbackSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    force: z.boolean().default(false),
  })
  .strict();

export const feedbackBriefQuerySchema = z
  .object({
    provider: z.enum(['local', 'ai']).default('local'),
  })
  .strict();
