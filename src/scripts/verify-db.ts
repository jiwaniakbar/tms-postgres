import { getDb } from '../lib/db';

async function verify() {
  console.log('Verifying Postgres Database...');
  const db = getDb();

  try {
    const res = await db.query('SELECT count(*) as count FROM profiles');
    const count = res.rows[0].count;
    console.log(`Profiles count: ${count}`);

    const trips = await db.query('SELECT count(*) as count FROM trips');
    console.log(`Trips count: ${trips.rows[0].count}`);

    const users = await db.query('SELECT count(*) as count FROM users');
    console.log(`Users count: ${users.rows[0].count}`);

    console.log('Verification Successful!');
  } catch (err) {
    console.error('Verification Failed:', err);
  } finally {
    await db.end();
  }
}

verify();
