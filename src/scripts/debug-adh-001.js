const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'jiwania',
  password: process.env.POSTGRES_PASSWORD || 'admin@123',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'tms',
  options: '-c timezone=Asia/Kolkata'
});

async function main() {
  try {
    const res = await pool.query("SELECT * FROM trips WHERE route_code = 'ADH-001'");
    console.log('ADH-001 Details:', res.rows[0]);
    
    // Check dashboard criteria
    const dashboardCriteria = `
      SELECT * FROM trips 
      WHERE route_code = 'ADH-001'
      AND (
        status IN ('Active', 'Arriving', 'Scheduled', 'Breakdown') 
        OR 
        (status IN ('Completed', 'Cancelled', 'Planned') AND start_time > NOW() - INTERVAL '7 days')
      )
    `;
    const dashRes = await pool.query(dashboardCriteria);
    console.log('Visible on Dashboard?', dashRes.rows.length > 0);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
