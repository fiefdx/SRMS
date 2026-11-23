/**
 * CLI wrapper for the demo data loader.
 *   npm run seed         migrate if needed, clear the tables and insert the demo records
 *   npm run seed --test  seed the test schema instead
 */
import config from '../src/config/env.js';
import { seedDatabase, summaryCounts, closePools } from '../src/db/seed.js';

const args = process.argv.slice(2);
const uri = args.includes('--test') ? config.db.testUri : config.db.uri;

try {
  await seedDatabase({ uri });
  const counts = await summaryCounts(uri);
  console.log('Demo data loaded:');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(18)} ${String(count).padStart(4)} rows`);
  }
  console.log('Demo password for every seeded account: demo1234');
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closePools();
}
