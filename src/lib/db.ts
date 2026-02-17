import { Pool, QueryResult } from 'pg';

process.env.PGTZ = 'Asia/Kolkata'; // Force node-postgres to use valid timezone


// Singleton instance
let pool: Pool | null = null;

export function getDb(): Pool {
  if (pool) return pool;

  pool = new Pool({
    user: process.env.POSTGRES_USER || 'jiwania',
    password: process.env.POSTGRES_PASSWORD || 'admin@123',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'tms',
    // Force timezone to avoid system default issues (e.g. 'gmt+0530' error)
    options: '-c timezone=Asia/Kolkata'
  });

  // Optional: Global error handler for idle clients
  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const db = getDb();
  try {
    return await db.query(text, params);
  } catch (err: any) {
    console.error('DB Query Error:', { text, params, error: err.message });
    throw err;
  }
}

// Define Profile Type
export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  role_id: number | null;
  region_id: number | null;
  location_id: number | null;
  created_at: string;
}

export interface Region {
  id: number;
  name: string;
  created_at: string;
}

export interface Venue {
  id: number;
  name: string;
  region_id: number;
  created_at: string;
}

export interface Event {
  id: number;
  name: string;
  region_id: number;
  created_at: string;
}

export interface Location {
  id: number;
  name: string;
  venue_id: number | null;
  region_id: number;
  created_at: string;
}

export interface Profile {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  age: number | null;
  bio: string;
  photo_url?: string;
  is_driver: number; // 0 for No, 1 for Yes
  alternate_phone?: string;
  location_id: number | null;
  created_at: string;
}

// Define Vehicle Type
export interface Vehicle {
  id: number;
  type: string; // Bus, Private Car, Taxi, Ambulance, etc.
  registration: string;
  capacity: number;
  make_model: string;
  status: string; // Active, Maintenance, Out of Service
  created_at: string;
}

// Define Trip Type
export interface Trip {
  id: number;
  route_code: string;
  origin_id: number | null;
  destination_id: number | null;
  origin_venue_id: number | null;
  destination_venue_id: number | null;
  region_id: number | null;
  start_time: string;
  end_time: string;
  vehicle_id: number | null;
  volunteer_id: number | null;
  driver_id: number | null;
  status: string; // Planned, Active, Cancelled, Completed, Breakdown
  sub_status: string; // Ready for onboarding, Enroute, At pit stop, Within 1 km of destination, Arrived, Parked
  breakdown_issue?: string;
  passengers_boarded: number;
  wheelchairs_boarded: number;
  notes?: string;
  created_at: string;
}

// Define Trip Status Type
export interface TripStatus {
  id: number;
  name: string;
  passenger_count_required: number; // 0 or 1
  sort_order: number;
}

// Define Trip Sub-Status Type
export interface TripSubStatus {
  id: number;
  name: string;
  linked_status: string; // The core status it maps to (e.g., Active)
  sort_order: number;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  is_system_role: number;
}

export interface RolePermission {
  id: number;
  role_id: number;
  module_code: string;
  can_view: number;
  can_edit: number;
}
