/**
 * Accounts and sessions.
 *
 * Passwords are stored as bcrypt hashes (never in plain text, never returned by the API) and a
 * successful sign-in returns a JWT that the frontend sends as `Authorization: Bearer <token>`.
 * `sub` is the user id, so the middleware can re-read the account on every request — that way a
 * deleted or demoted account cannot keep using an old token.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { execute, queryOne } from '../db/pool.js';
import ApiError from '../utils/ApiError.js';

export const SALT_ROUNDS = 10;

/** Columns that are safe to send to a client — password_hash is deliberately excluded. */
export const USER_COLUMNS = 'id, name, email, role, phone, address, dietary_tags, favourites, created_at';

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone ?? null,
    address: row.address ?? null,
    dietaryTags: toArray(row.dietary_tags),
    favourites: toArray(row.favourites),
    createdAt: row.created_at,
  };
}

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

export async function findUserById(id, uri) {
  return queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id], uri);
}

export async function findUserByEmail(email, uri) {
  return queryOne('SELECT * FROM users WHERE email = ?', [email], uri);
}

/** Create a customer account. Emails are unique in the schema, and the duplicate is reported as 409. */
export async function register(input, uri) {
  const existing = await findUserByEmail(input.email, uri);
  if (existing) throw ApiError.conflict('That email is already registered', { field: 'email' });

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const result = await execute(
    `INSERT INTO users (name, email, password_hash, role, phone, address, dietary_tags)
     VALUES (?, ?, ?, 'customer', ?, ?, ?)`,
    [
      input.name,
      input.email,
      passwordHash,
      input.phone ?? null,
      input.address ?? null,
      JSON.stringify(input.dietaryTags ?? []),
    ],
    uri,
  );

  const row = await findUserById(result.insertId, uri);
  const user = toPublicUser(row);
  return { user, token: signToken(user) };
}

/**
 * Check credentials. A wrong email and a wrong password return exactly the same message and status so
 * the endpoint cannot be used to find out which addresses already have accounts.
 */
export async function login(input, uri) {
  const row = await findUserByEmail(input.email, uri);
  const hash = row?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';

  const passwordMatches = await bcrypt.compare(input.password, hash);
  if (!row || !passwordMatches) throw ApiError.unauthorized('Email or password is incorrect');

  const user = toPublicUser(row);
  return { user, token: signToken(user) };
}
