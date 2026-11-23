/**
 * Migration runner.
 *
 * src/db/schema.sql is the database design: InnoDB tables, foreign keys, check constraints, unique
 * keys (email, menu name, order/reservation reference) and indexes for the queries the API runs.
 * The runner creates the schema if it is missing, and `fresh: true` drops the whole database first
 * so a demo can always be reset to a known state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { parseUri, defaultUri } from './pool.js';
import config from '../config/env.js';

const SCHEMA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

export function readSchemaStatements(file = SCHEMA_FILE) {
  const sql = fs.readFileSync(file, 'utf8');
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Connect to the server itself (no database selected) so the schema can be created or dropped. */
async function connectServer(uri) {
  const { host, port, user, password } = parseUri(uri);
  return mysql.createConnection({
    host,
    port,
    user,
    password,
    connectTimeout: config.db.connectTimeoutMs,
    multipleStatements: false,
  });
}

export async function runMigration({ uri = defaultUri(), fresh = false } = {}) {
  const { database } = parseUri(uri);
  if (!database) throw new Error('The database URI must include a schema name, e.g. …/srms');

  const connection = await connectServer(uri);
  const applied = [];

  try {
    if (fresh) {
      await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
      applied.push(`DROP DATABASE ${database}`);
    }

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${database}\``);

    for (const statement of readSchemaStatements()) {
      await connection.query(statement);
      applied.push(`${statement.split('\n')[0].slice(0, 60)}…`);
    }

    const [rows] = await connection.query(
      'SELECT TABLE_NAME AS name, TABLE_ROWS AS rows_count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [database],
    );

    return { database, applied, tables: rows };
  } finally {
    await connection.end();
  }
}

export async function dropDatabase({ uri = defaultUri() } = {}) {
  const { database } = parseUri(uri);
  const connection = await connectServer(uri);
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
  } finally {
    await connection.end();
  }
}
