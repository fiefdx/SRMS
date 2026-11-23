/**
 * Validation for user management. Two update schemas on purpose: the one a customer can post about
 * themselves never mentions `role`, so a normal account cannot escalate itself even if someone edits the
 * request in devtools. The admin schema is the only one that allows a role change.
 */
import { z } from 'zod';

const name = z.string().trim().min(2, 'Enter your name').max(80);
const phone = z.string().trim().max(30).nullable();
const address = z.string().trim().max(200).nullable();
const dietaryTags = z.array(z.string().trim().min(1).max(30)).max(12);
const favourites = z.array(z.coerce.number().int().positive()).max(100);
const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((value) => /[a-zA-Z]/.test(value), 'Password must contain a letter')
  .refine((value) => /\d/.test(value), 'Password must contain a number');

const profileFields = z.object({
  name: name.optional(),
  phone: phone.optional(),
  address: address.optional(),
  dietaryTags: dietaryTags.optional(),
  favourites: favourites.optional(),
  password: newPassword.optional(),
  currentPassword: z.string().min(1, 'Enter your current password').optional(),
});

function requireAtLeastOneChange(schema) {
  return schema.refine((data) => Object.keys(data).length > 0, { message: 'No changes were sent' });
}

export const profileUpdateSchema = requireAtLeastOneChange(profileFields.strict());

export const adminUserUpdateSchema = requireAtLeastOneChange(
  profileFields.extend({ role: z.enum(['customer', 'admin']).optional() }).strict(),
);

export const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive('User id must be a positive number'),
});

export const listUsersQuerySchema = z
  .object({
    search: z.string().trim().max(60).optional(),
    role: z.enum(['customer', 'admin']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const favouritesSchema = z
  .object({
    itemIds: favourites,
  })
  .strict();
