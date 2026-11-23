/**
 * Menu validation. The category, dietary tag and allergen lists are declared here because they are the
 * same lists the frontend filter uses (client/src/data/menuData.js) — one place per side, and the API
 * refuses anything outside them instead of storing free text.
 */
import { z } from 'zod';

export const MENU_CATEGORIES = ['starter', 'main', 'dessert', 'beverage'];
export const DIETARY_TAGS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'spicy'];
export const ALLERGENS = ['gluten', 'dairy', 'egg', 'fish', 'shellfish', 'sesame', 'nut', 'soy'];

const money = z.coerce
  .number()
  .finite('Price must be a number')
  .positive('Price must be greater than zero')
  .max(999.99, 'Price is too large');

const textList = z.array(z.string().trim().min(1).max(40));

/** Customer-side browsing: the filters and sorting offered on the menu page. */
export const listMenuQuerySchema = z
  .object({
    search: z.string().trim().max(60).optional(),
    category: z.enum(MENU_CATEGORIES, { message: `category must be one of: ${MENU_CATEGORIES.join(', ')}` }).optional(),
    dietary: z.enum(DIETARY_TAGS, { message: `dietary must be one of: ${DIETARY_TAGS.join(', ')}` }).optional(),
    freeFrom: z.enum(ALLERGENS, { message: `freeFrom must be one of: ${ALLERGENS.join(', ')}` }).optional(),
    available: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    todaySpecial: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    sort: z.enum(['name', 'price', 'popularity', 'category', 'id']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    limit: z.coerce.number().int().min(1).max(100).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const menuItemIdParamSchema = z.object({
  itemId: z.coerce.number().int().positive('Menu item id must be a positive number'),
});

const dishFields = {
  name: z.string().trim().min(2, 'Enter a dish name').max(80),
  category: z.enum(MENU_CATEGORIES, { message: `category must be one of: ${MENU_CATEGORIES.join(', ')}` }),
  description: z.string().trim().max(300),
  price: money,
  ingredients: textList.max(20),
  allergens: z.array(z.enum(ALLERGENS, { message: `allergens must be one of: ${ALLERGENS.join(', ')}` })).max(10),
  dietaryTags: z.array(z.enum(DIETARY_TAGS, { message: `dietaryTags must be one of: ${DIETARY_TAGS.join(', ')}` })).max(8),
  available: z.boolean(),
  todaySpecial: z.boolean(),
  emoji: z.string().trim().max(8).nullable(),
};

/** Administrator: create a dish. `popularity` is deliberately absent — it is derived from orders. */
export const createMenuItemSchema = z.object(dishFields).strict();

/** Administrator: change any subset of a dish. */
export const updateMenuItemSchema = z
  .object(Object.fromEntries(Object.entries(dishFields).map(([key, schema]) => [key, schema.optional()])))
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'No changes were sent' });
