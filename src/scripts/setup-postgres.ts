import { initPostgresSchema } from '../lib/init-postgres';
import { getPool } from '../lib/db-postgres';

async function main() {
  try {
    console.log('Initializing Postgres Schema...');
    await initPostgresSchema();
    console.log('Done.');
  } catch (err) {
    console.error('Error initializing schema:', err);
  } finally {
    const pool = getPool();
    await pool.end();
  }
}

main();
