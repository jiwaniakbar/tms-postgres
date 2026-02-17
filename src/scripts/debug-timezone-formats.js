
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
    console.log('Testing timezone formats...');
    
    // Test +05:30
    try {
      await pool.query("SET TIME ZONE '+05:30'");
      console.log("Success: '+05:30' is valid.");
    } catch (e) {
      console.log("Error: '+05:30' is invalid:", e.message);
    }
    
    // Test +0530
    try {
      await pool.query("SET TIME ZONE '+0530'");
      console.log("Success: '+0530' is valid.");
    } catch (e) {
      console.log("Error: '+0530' is invalid:", e.message);
    }

    // Test GMT+05:30
    try {
      await pool.query("SET TIME ZONE 'GMT+05:30'");
      console.log("Success: 'GMT+05:30' is valid.");
    } catch (e) {
      console.log("Error: 'GMT+05:30' is invalid:", e.message);
    }
    
    // Test GMT+0530 (The error case)
    try {
      await pool.query("SET TIME ZONE 'GMT+0530'");
      console.log("Success: 'GMT+0530' is valid.");
    } catch (e) {
      console.log("Error: 'GMT+0530' is invalid:", e.message);
    }
    
    // Test gmt+0530 (Lowercase)
    try {
      await pool.query("SET TIME ZONE 'gmt+0530'");
      console.log("Success: 'gmt+0530' is valid.");
    } catch (e) {
      console.log("Error: 'gmt+0530' is invalid:", e.message);
    }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end();
  }
}

main();
