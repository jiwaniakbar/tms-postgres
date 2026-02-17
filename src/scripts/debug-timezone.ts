
import { getDb } from '../lib/db';

async function main() {
  const db = getDb();
  
  try {
    const res = await db.query('SHOW TIME ZONE');
    console.log('Current Session Timezone:', res.rows[0].TimeZone);
    
    const settings = await db.query('SELECT * FROM app_settings WHERE key = $1', ['timezone']);
    console.log('App Setting Timezone:', settings.rows[0]);
    
    try {
      console.log("Trying to set timezone to 'gmt+0530'...");
      await db.query("SET TIME ZONE 'gmt+0530'");
      console.log("Success: 'gmt+0530' is valid.");
    } catch (e: any) {
      console.error("Error setting 'gmt+0530':", e.message);
    }

    try {
      console.log("Trying to set timezone to 'Asia/Kolkata'...");
      await db.query("SET TIME ZONE 'Asia/Kolkata'");
      console.log("Success: 'Asia/Kolkata' is valid.");
    } catch (e: any) {
      console.error("Error setting 'Asia/Kolkata':", e.message);
    }
    
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    process.exit(0);
  }
}

main();
