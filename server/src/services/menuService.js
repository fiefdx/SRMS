/**
 * Menu management rules.
 *
 * Filtering is done in SQL (LIKE for the search box, JSON_CONTAINS for the dietary tag and allergen
 * lists) so the menu page can be filtered without pulling the whole menu into the application. Every
 * value still goes through a placeholder, and the sort column can only be one of the names in
 * SORT_COLUMNS — a user-supplied string is never pasted into ORDER BY.
 */
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
import ApiError from '../utils/ApiError.js';
import { toMenuItem } from '../mappers/menuItem.js';
import { DIETARY_TAGS } from '../validation/menuSchemas.js';

const SORT_COLUMNS = { name: 'name', price: 'price', popularity: 'popularity', category: 'category', id: 'id' };

/** input field -> column, the only pairs update() will write. */
const COLUMN_FOR_FIELD = {
  name: 'name',
  category: 'category',
  description: 'description',
  price: 'price',
  ingredients: 'ingredients',
  allergens: 'allergens',
  dietaryTags: 'dietary_tags',
  available: 'available',
  todaySpecial: 'today_special',
  emoji: 'emoji',
};

function buildFilters({ search, category, dietary, freeFrom, available, todaySpecial }) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(name LIKE ? OR description LIKE ? OR ingredients LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (dietary) {
    where.push('JSON_CONTAINS(dietary_tags, JSON_QUOTE(?))');
    params.push(dietary);
  }
  if (freeFrom) {
    where.push('(allergens IS NULL OR NOT JSON_CONTAINS(allergens, JSON_QUOTE(?)))');
    params.push(freeFrom);
  }
  if (available !== undefined) {
    where.push('available = ?');
    params.push(available ? 1 : 0);
  }
  if (todaySpecial !== undefined) {
    where.push('today_special = ?');
    params.push(todaySpecial ? 1 : 0);
  }

  return { filter: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function listMenu(query_ = {}, uri) {
  const { search, category, dietary, freeFrom, available, todaySpecial, sort = 'name', order = 'asc', limit = 100, offset = 0 } = query_;
  const { filter, params } = buildFilters({ search, category, dietary, freeFrom, available, todaySpecial });

  const sortColumn = SORT_COLUMNS[sort] ?? SORT_COLUMNS.name;
  const direction = order === 'desc' ? 'DESC' : 'ASC';

  const rows = await query(
    `SELECT * FROM menu_items ${filter} ORDER BY ${sortColumn} ${direction}, name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
    uri,
  );
  const totals = await query(`SELECT COUNT(*) AS total FROM menu_items ${filter}`, params, uri);

  return { total: Number(totals[0].total), limit, offset, items: rows.map(toMenuItem) };
}

/** What the menu page needs for its filter chips, counted by the database. */
export async function menuFacets(uri) {
  const categories = await query(
    'SELECT category, COUNT(*) AS items FROM menu_items GROUP BY category ORDER BY category',
    [],
    uri,
  );

  // One row per known dietary tag so the frontend can show "vegan (6)" without counting in JavaScript.
  const tagRows = await query(
    DIETARY_TAGS.map((tag) => `SELECT '${tag}' AS tag, COUNT(*) AS items FROM menu_items WHERE JSON_CONTAINS(dietary_tags, JSON_QUOTE('${tag}'))`).join(
      ' UNION ALL ',
    ),
    [],
    uri,
  );

  return { categories, dietaryTags: tagRows };
}

export async function getMenuItem(itemId, uri) {
  const row = await queryOne('SELECT * FROM menu_items WHERE id = ?', [itemId], uri);
  if (!row) throw ApiError.notFound('No menu item with that id');
  return toMenuItem(row);
}

export async function createMenuItem(data, uri) {
  const result = await execute(
    `INSERT INTO menu_items (name, category, description, price, ingredients, allergens, dietary_tags, available, today_special, emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.category,
      data.description ?? '',
      data.price,
      JSON.stringify(data.ingredients ?? []),
      JSON.stringify(data.allergens ?? []),
      JSON.stringify(data.dietaryTags ?? []),
      data.available ? 1 : 0,
      data.todaySpecial ? 1 : 0,
      data.emoji ?? null,
    ],
    uri,
  );

  /* A second dish with the same name is stopped by the unique index; the error middleware turns
     ER_DUP_ENTRY into a 409. Marking the new dish as today's special clears the previous one. */
  if (data.todaySpecial) await onlyOneTodaysSpecial(result.insertId, uri);

  return getMenuItem(result.insertId, uri);
}

/** The restaurant advertises one special per day, so the flag is moved rather than copied. */
async function onlyOneTodaysSpecial(itemId, uri) {
  await execute('UPDATE menu_items SET today_special = 0 WHERE id <> ?', [itemId], uri);
}

export async function updateMenuItem(itemId, changes, uri) {
  const existing = await queryOne('SELECT id FROM menu_items WHERE id = ?', [itemId], uri);
  if (!existing) throw ApiError.notFound('No menu item with that id');

  const sets = [];
  const params = [];

  for (const [field, column] of Object.entries(COLUMN_FOR_FIELD)) {
    if (!(field in changes)) continue;
    const value = changes[field];
    sets.push(`${column} = ?`);
    if (field === 'ingredients' || field === 'allergens' || field === 'dietaryTags') params.push(JSON.stringify(value ?? []));
    else if (field === 'available' || field === 'todaySpecial') params.push(value ? 1 : 0);
    else if (field === 'emoji') params.push(value ?? null);
    else params.push(value);
  }

  if (sets.length === 0) throw ApiError.badRequest('No changes were sent');

  if (changes.todaySpecial) {
    await withTransaction(async (connection) => {
      await connection.execute('UPDATE menu_items SET today_special = 0 WHERE id <> ?', [itemId]);
      await connection.execute(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`, [...params, itemId]);
    });
  } else {
    await execute(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`, [...params, itemId], uri);
  }

  return getMenuItem(itemId, uri);
}

export async function deleteMenuItem(itemId, uri) {
  const existing = await queryOne('SELECT id, name FROM menu_items WHERE id = ?', [itemId], uri);
  if (!existing) throw ApiError.notFound('No menu item with that id');

  /* Past order lines keep the name and price they were sold at and only lose the link to the dish
     (order_items.menu_item_id is ON DELETE SET NULL), so order history survives a deleted dish. */
  await execute('DELETE FROM menu_items WHERE id = ?', [itemId], uri);
  return { deleted: true, id: itemId, name: existing.name };
}
