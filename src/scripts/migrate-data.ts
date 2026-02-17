import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';

// --- Configuration ---
const SQLITE_PATH = path.join(process.cwd(), 'sqlite.db'); // Adjust if needed
const PG_CONFIG = {
  user: process.env.POSTGRES_USER || 'jiwania',
  password: process.env.POSTGRES_PASSWORD || 'admin@123',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'tms',
};

// --- Connections ---
const sqlite = new Database(SQLITE_PATH);
const pg = new Pool(PG_CONFIG);

async function migrateTable(tableName: string, columns: string[], idColumn = 'id') {
  console.log(`Migrating table: ${tableName}...`);
  try {
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    if (rows.length === 0) {
      console.log(`  No rows to migrate.`);
      return;
    }

    // Construct INSERT query
    // We assume columns match or we map them. For simplicity, we assume strict mapping for now.
    // If strict mapping fails, we'll need manual mapping.
    
    // Check if columns exist in rows[0] to avoid errors if SQLite has extra columns
    const validColumns = columns.filter(col => Object.prototype.hasOwnProperty.call(rows[0], col) || (rows[0] as any)[col] !== undefined);
    
    if (validColumns.length === 0) {
        console.warn(`  Warning: No valid columns found for table ${tableName}. Skipping.`);
        return;
    }

    const placeholders = validColumns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${tableName} (${validColumns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${idColumn}) DO NOTHING`;

    for (const row of rows) {
      const values = validColumns.map(col => (row as any)[col]);
      await pg.query(query, values);
    }

    // Reset sequence
    if (idColumn === 'id') {
      const maxIdSql = `SELECT MAX(id) as max_id FROM ${tableName}`;
      const res = await pg.query(maxIdSql);
      const maxId = res.rows[0].max_id || 0;
      await pg.query(`SELECT setval('${tableName}_id_seq', $1, true)`, [maxId]);
      console.log(`  Sequence reset to ${maxId}`);
    }

    console.log(`  Migrated ${rows.length} rows.`);
  } catch (err) {
    console.error(`  Error migrating ${tableName}:`, err);
    // Don't throw, try to continue with other tables
  }
}

async function main() {
  try {
    console.log('Starting Data Migration...');

    // Dependency Order
    await migrateTable('app_settings', ['key', 'value'], 'key');
    await migrateTable('regions', ['id', 'name', 'created_at']);
    await migrateTable('venues', ['id', 'name', 'region_id', 'created_at']);
    await migrateTable('events', ['id', 'name', 'region_id', 'created_at']);
    await migrateTable('event_venues', ['id', 'name', 'event_id', 'created_at']);
    await migrateTable('locations', ['id', 'name', 'venue_id', 'region_id', 'created_at']);
    
    await migrateTable('roles', ['id', 'name', 'description', 'is_system_role']);
    await migrateTable('role_permissions', ['id', 'role_id', 'module_code', 'can_view', 'can_edit']);
    
    await migrateTable('users', ['id', 'name', 'email', 'password_hash', 'role', 'role_id', 'region_id', 'location_id', 'created_at']);
    await migrateTable('profiles', ['id', 'name', 'email', 'phone', 'dob', 'age', 'bio', 'photo_url', 'is_driver', 'alternate_phone', 'location_id', 'created_at']);
    await migrateTable('vehicles', ['id', 'type', 'registration', 'capacity', 'make_model', 'status', 'created_at']);
    
    await migrateTable('trip_statuses', ['id', 'name', 'passenger_count_required', 'sort_order']);
    await migrateTable('trip_sub_statuses', ['id', 'name', 'linked_status', 'sort_order']);
    
    // Trips might be large, doing row by row is slow but safe.
    await migrateTable('trips', [
      'id', 'route_code', 'origin_id', 'destination_id', 'origin_venue_id', 'destination_venue_id',
      'region_id', 'start_time', 'end_time', 'vehicle_id', 'volunteer_id', 'driver_id',
      'status', 'sub_status', 'breakdown_issue', 'passengers_boarded', 'wheelchairs_boarded', 'notes', 'created_at'
    ]);

    await migrateTable('trip_status_history', [
      'id', 'trip_id', 'status', 'sub_status', 'breakdown_issue', 'passengers_boarded', 'changed_at'
    ]);

    console.log('Data Migration Completed!');

  } catch (err) {
    console.error('Migration Fatal Error:', err);
  } finally {
    await pg.end();
    sqlite.close();
  }
}

main();
