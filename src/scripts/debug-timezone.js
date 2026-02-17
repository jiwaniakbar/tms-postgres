
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER || 'jiwania',
    password: process.env.POSTGRES_PASSWORD || 'admin@123',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'tms',
  });

  try {
    const res = await pool.query('SHOW TIME ZONE');
    console.log('Current Session Timezone:', res.rows[0].TimeZone);
    
    // Check if app_settings table exists
    const tableExists = await pool.query("SELECT to_regclass('public.app_settings')");
    if (tableExists.rows[0].to_regclass) {
      const settings = await pool.query("SELECT * FROM app_settings WHERE key = 'timezone'");
      if (settings.rows.length > 0) {
        console.log('App Setting Timezone:', settings.rows[0]);
      } else {
        console.log('App Setting Timezone: Not Set');
      }
    } else {
      console.log('app_settings table does not exist');
    }
    
    try {
      console.log("Trying to set timezone to 'gmt+0530'...");
      await pool.query("SET TIME ZONE 'gmt+0530'");
      console.log("Success: 'gmt+0530' is valid.");
    } catch (e) {
      console.error("Error setting 'gmt+0530':", e.message);
    }

    try {
      console.log("Trying to set timezone to 'Asia/Kolkata'...");
      await pool.query("SET TIME ZONE 'Asia/Kolkata'");
      console.log("Success: 'Asia/Kolkata' is valid.");
    } catch (e) {
      console.error("Error setting 'Asia/Kolkata':", e.message);
    }
    
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end();
  }
}

main();
