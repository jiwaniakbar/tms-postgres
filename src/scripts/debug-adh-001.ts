import { getDb } from '../lib/db';

async function main() {
  const db = getDb();
  const res = await db.query("SELECT * FROM trips WHERE route_code = 'ADH-001'");
  console.log('ADH-001 Details:', res.rows[0]);
  process.exit(0);
}

main().catch(console.error);
