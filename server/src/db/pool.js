/**
 * MySQL connection pool (mysql2/promise).
 *
 * - One pool per connection string, created lazily, reused by every request.
 * - `dateStrings: true` so DATE/TIME/TIMESTAMP come back as plain strings: a reservation made for
 *   19:00 must serialise as "19:00:00" regardless of the machine's timezone.
 * - Tests use a separate schema (MYSQL_TEST_URI) so they can be reset without touching dev data.
 * - `withTransaction` exists for the reservation availability check, which must lock the slot it is
 *   about to insert.
 */
import mysql from 'mysql2/promise';
import config from '../config/env.js';

const pools = new Map();

export function parseUri(uri) {
  const url = new URL(uri);
  return {
    host: url.hostname || '127.0.0.1',
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || 'root'),
    password: decodeURIComponent(url.password || ''),
    database: url.pathname.replace(/^\//, '') || undefined,
  };
}

export function defaultUri() {
  return config.isTest ? config.db.testUri : config.db.uri;
}

export function getPool(uri = defaultUri()) {
  if (!pools.has(uri)) {
    pools.set(
      uri,
      mysql.createPool({
        ...parseUri(uri),
        waitForConnections: true,
        connectionLimit: config.db.poolSize,
        connectTimeout: config.db.connectTimeoutMs,
        dateStrings: true,
        charset: 'utf8mb4_unicode_ci',
      }),
    );
  }
  return pools.get(uri);
}

/** SELECT-style helper: returns the rows. */
export async function query(sql, params = [], uri) {
  const [rows] = await getPool(uri).query(sql, params);
  return rows;
}

/** SELECT one row, or null. */
export async function queryOne(sql, params = [], uri) {
  const rows = await query(sql, params, uri);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE helper: returns { insertId, affectedRows, … }. */
export async function execute(sql, params = [], uri) {
  const [result] = await getPool(uri).execute(sql, params);
  return result;
}

/**
 * Run `work(conn)` inside a transaction; commit on success, roll back on any throw.
 * The callback receives the pinned connection, so it can use `conn.query(... FOR UPDATE)`.
 */
export async function withTransaction(work, uri) {
  const connection = await getPool(uri).getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Availability probe. It opens its own short-lived connection rather than using the pool, because a
 * health probe (or a one-off script) must not leave an idle pool holding sockets open.
 */
export async function ping(uri) {
  const { host, port, user, password, database } = parseUri(uri ?? defaultUri());
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: config.db.connectTimeoutMs,
  });
  try {
    const [rows] = await connection.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } finally {
    await connection.end();
  }
}

export async function closePools() {
  const all = [...pools.values()];
  pools.clear();
  await Promise.all(all.map((pool) => pool.end()));
}
