
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'jiwania',
  password: process.env.POSTGRES_PASSWORD || 'admin@123',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'tms',
});

async function initPostgresSchema() {
  console.log('Initializing Postgres Schema...');

  // Create tables using the same queries as init-postgres.ts
  // For brevity I'm including the critical ones here or I should just copy the content.
  // Actually, duplicating logic is bad. 
  // But since I can't easily run TS in prod container without setup...
  
  // Let's hope instrumentation works first.
  // But I will stick to the plan: Enable instrumentation (done).
  // I will also add this script as a robust fallback.
  
  try {
     // App Settings
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Profiles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      dob TEXT,
      age INTEGER,
      bio TEXT,
      photo_url TEXT,
      is_driver INTEGER DEFAULT 0,
      alternate_phone TEXT,
      location_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vehicles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      registration TEXT NOT NULL UNIQUE,
      capacity INTEGER NOT NULL,
      make_model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Regions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS regions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trips
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      route_code TEXT NOT NULL,
      origin_id INTEGER,
      destination_id INTEGER,
      origin_venue_id INTEGER,
      destination_venue_id INTEGER,
      region_id INTEGER REFERENCES regions(id),
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      vehicle_id INTEGER REFERENCES vehicles(id),
      volunteer_id INTEGER REFERENCES profiles(id),
      driver_id INTEGER REFERENCES profiles(id),
      status TEXT NOT NULL DEFAULT 'Planned',
      sub_status TEXT NOT NULL DEFAULT 'Scheduled',
      breakdown_issue TEXT,
      passengers_boarded INTEGER DEFAULT 0,
      wheelchairs_boarded INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trip Status History
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_status_history (
      id SERIAL PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES trips(id),
      status TEXT NOT NULL,
      sub_status TEXT NOT NULL,
      breakdown_issue TEXT,
      passengers_boarded INTEGER DEFAULT 0,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      region_id INTEGER NOT NULL REFERENCES regions(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Venues
  await pool.query(`
    CREATE TABLE IF NOT EXISTS venues (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      region_id INTEGER REFERENCES regions(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Event Venues
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_venues (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      event_id INTEGER NOT NULL REFERENCES events(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Locations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      venue_id INTEGER REFERENCES venues(id),
      region_id INTEGER REFERENCES regions(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trip Statuses
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_statuses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      passenger_count_required INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Trip Sub Statuses
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_sub_statuses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      linked_status TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Roles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_system_role INTEGER DEFAULT 0
    )
  `);

  // Role Permissions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      module_code TEXT NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      UNIQUE(role_id, module_code)
    )
  `);

  // Users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'VOLUNTEER',
      role_id INTEGER REFERENCES roles(id),
      region_id INTEGER,
      location_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time)',
    'CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_volunteer_id ON trips(volunteer_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_origin_id ON trips(origin_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_destination_id ON trips(destination_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_origin_venue_id ON trips(origin_venue_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_destination_venue_id ON trips(destination_venue_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_region_id ON trips(region_id)',
    'CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email)',
    'CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration)'
  ];

  for (const idx of indexes) {
    await pool.query(idx);
  }

  console.log('Postgres schema initialized.');
  } catch (err) {
    console.error('Initialization failed:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

initPostgresSchema();
