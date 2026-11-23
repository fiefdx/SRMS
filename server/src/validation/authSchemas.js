/**
 * Sign-in and registration rules. These are the API-side mirror of what the frontend form expects, so
 * the same input cannot be accepted by one side and rejected by the other.
 */
import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(80),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .transform((email) => email.toLowerCase()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .refine((value) => /[a-zA-Z]/.test(value), 'Password must contain a letter')
      .refine((value) => /\d/.test(value), 'Password must contain a number'),
    phone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(200).optional(),
    dietaryTags: z.array(z.string().trim().min(1)).max(12).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address').transform((email) => email.toLowerCase()),
    password: z.string().min(1, 'Enter your password'),
  })
  .strict();
