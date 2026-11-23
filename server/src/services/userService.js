/**
 * User management rules: listing and searching accounts, updating a profile, changing preferences and
 * favourites, changing roles and removing an account.
 *
 * Only whitelisted columns can ever reach the SQL (the keys below), so user input cannot become part of
 * the statement itself. Roles are changed by administrators only, and the last administrator cannot be
 * demoted or deleted — otherwise the system would lock itself out.
 */
import bcrypt from 'bcryptjs';
import { execute, query, queryOne } from '../db/pool.js';
import ApiError from '../utils/ApiError.js';
import { SALT_ROUNDS, USER_COLUMNS, findUserById, toPublicUser } from './authService.js';
import { toMenuItem } from '../mappers/menuItem.js';

/** input field -> database column, the only pairs update() accepts. */
const COLUMN_FOR_FIELD = {
  name: 'name',
  phone: 'phone',
  address: 'address',
  dietaryTags: 'dietary_tags',
  favourites: 'favourites',
  password: 'password_hash',
  role: 'role',
};

export async function listUsers({ search, role, limit = 50, offset = 0 } = {}, uri) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role) {
    where.push('role = ?');
    params.push(role);
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(`SELECT ${USER_COLUMNS} FROM users ${filter} ORDER BY id LIMIT ? OFFSET ?`, [...params, limit, offset], uri);
  const totals = await query(`SELECT COUNT(*) AS total FROM users ${filter}`, params, uri);

  return {
    total: Number(totals[0].total),
    limit,
    offset,
    users: rows.map(toPublicUser),
  };
}

export async function getUser(userId, uri) {
  const row = await findUserById(userId, uri);
  if (!row) throw ApiError.notFound('No account with that id');
  return toPublicUser(row);
}

async function countAdmins(uri) {
  const rows = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'", [], uri);
  return Number(rows[0].total);
}

/** The stored row *including* password_hash — only used inside the service, never returned. */
async function loadPrivateUser(userId, uri) {
  return queryOne('SELECT * FROM users WHERE id = ?', [userId], uri);
}

/** Favourites hold menu ids, so an unknown id is reported as a validation error, not a foreign key crash. */
async function assertMenuItemsExist(ids, uri) {
  if (ids.length === 0) return;
  const rows = await query('SELECT id FROM menu_items WHERE id IN (?)', [ids], uri);
  const known = new Set(rows.map((row) => row.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) {
    throw ApiError.unprocessable('Some favourites are not on the menu', unknown.map((id) => ({ field: 'favourites', value: id })));
  }
}

/**
 * Update one account.
 *
 * @param userId  the account being changed
 * @param changes validated input (see validation/userSchemas.js)
 * @param actor   the signed-in account, used for the rules an administrator has to respect
 */
export async function updateUser(userId, changes, actor, uri) {
  const target = await loadPrivateUser(userId, uri);
  if (!target) throw ApiError.notFound('No account with that id');

  if (changes.role && changes.role !== target.role) {
    if (actor.role !== 'admin') throw ApiError.forbidden('Only an administrator can change roles');
    if (actor.id === target.id) throw ApiError.badRequest('You cannot change your own role');
    if (target.role === 'admin' && (await countAdmins(uri)) <= 1) {
      throw ApiError.conflict('That is the last administrator account');
    }
  }

  if (changes.password) {
    const matches = await bcrypt.compare(changes.currentPassword ?? '', target.password_hash);
    if (!matches) {
      throw ApiError.unprocessable('Your current password is not correct', [{ field: 'currentPassword' }]);
    }
  }

  if (changes.favourites) await assertMenuItemsExist(changes.favourites, uri);

  const sets = [];
  const params = [];

  for (const [field, column] of Object.entries(COLUMN_FOR_FIELD)) {
    if (!(field in changes)) continue;

    let value = changes[field];
    if (field === 'password') value = await bcrypt.hash(value, SALT_ROUNDS);
    else if (field === 'dietaryTags' || field === 'favourites') value = JSON.stringify(value);
    else if (value === undefined) continue;

    sets.push(`${column} = ?`);
    params.push(value);
  }

  if (sets.length === 0) throw ApiError.badRequest('No changes were sent');

  await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, userId], uri);
  return toPublicUser(await findUserById(userId, uri));
}

/** Replace the favourites list in one call (the frontend sends the whole list). */
export async function setFavourites(userId, itemIds, uri) {
  await assertMenuItemsExist(itemIds, uri);
  await execute('UPDATE users SET favourites = ? WHERE id = ?', [JSON.stringify(itemIds), userId], uri);
  return getFavourites(userId, uri);
}

/** The saved favourites, expanded into the menu items they point at (in the order the customer saved them). */
export async function getFavourites(userId, uri) {
  const row = await findUserById(userId, uri);
  if (!row) throw ApiError.notFound('No account with that id');

  const ids = Array.isArray(row.favourites) ? row.favourites : JSON.parse(row.favourites || '[]');
  if (ids.length === 0) return [];

  const rows = await query('SELECT * FROM menu_items WHERE id IN (?)', [ids], uri);
  return ids.map((id) => toMenuItem(rows.find((item) => item.id === id))).filter(Boolean);
}

export async function deleteUser(userId, actor, uri) {
  const target = await findUserById(userId, uri);
  if (!target) throw ApiError.notFound('No account with that id');
  if (target.id === actor.id) throw ApiError.badRequest('You cannot delete the account you are signed in with');
  if (target.role === 'admin' && (await countAdmins(uri)) <= 1) {
    throw ApiError.conflict('That is the last administrator account');
  }

  /* Orders and reservations cascade with the account (see schema.sql); feedback keeps the comment and
     loses the author link, which is what you want when someone closes their account. */
  await execute('DELETE FROM users WHERE id = ?', [userId], uri);
  return { deleted: true, id: userId };
}
