/**
 * CLI wrapper for the migration runner.
 *   npm run migrate          create the schema if it does not exist
 *   npm run migrate:fresh    drop the schema and rebuild it
 *   npm run migrate --test   migrate the test schema (MYSQL_TEST_URI)
 */
import config from '../src/config/env.js';
import { runMigration } from '../src/db/migrate.js';
import { closePools } from '../src/db/pool.js';

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const uri = args.includes('--test') ? config.db.testUri : config.db.uri;

try {
  const result = await runMigration({ uri, fresh });
  console.log(`Schema "${result.database}" ${fresh ? 'dropped and rebuilt' : 'ready'} in ${result.applied.length} statements`);
  for (const table of result.tables) {
    console.log(`  ${table.name.padEnd(18)} ${String(table.rows_count).padStart(4)} rows`);
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  console.error('Check MYSQL_URI / MYSQL_TEST_URI in server/.env and that MySQL is running.');
  process.exitCode = 1;
} finally {
  await closePools();
}
