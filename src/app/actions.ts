'use server';

import { getDb, Profile, Vehicle, Trip, TripSubStatus } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { writeFile } from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';

function calculateAge(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

async function savePhoto(photo: File | null): Promise<string | undefined> {
  if (!photo || photo.size === 0) return undefined;

  const bytes = await photo.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = photo.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.${ext}`;
  const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);

  await writeFile(filePath, buffer);
  return `/uploads/${fileName}`;
}

export async function createProfile(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const dob = formData.get('dob') as string;
  const bio = formData.get('bio') as string;
  const photo = formData.get('photo') as File | null;
  const is_driver = formData.get('is_driver') ? 1 : 0;
  const alternate_phone = formData.get('alternate_phone') as string;

  const age = calculateAge(dob);
  const photo_url = await savePhoto(photo);

  const db = getDb();

  try {
    await db.query(`
      INSERT INTO profiles (name, email, phone, dob, age, bio, photo_url, is_driver, alternate_phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [name, email || null, phone, dob || null, age, bio || null, photo_url || null, is_driver, alternate_phone || null]);
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      throw new Error('Email already exists');
    }
    throw err;
  }

  revalidatePath('/');
  redirect('/');
}

export async function createQuickProfile(name: string, phone: string, alternate_phone?: string): Promise<{ success: boolean; id?: number; error?: string; phone?: string; alternate_phone?: string }> {
  try {
    const db = getDb();
    const res = await db.query(`
      INSERT INTO profiles (name, phone, alternate_phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [name, phone, alternate_phone || null]);

    const id = res.rows[0].id;

    // Invalidate everything so the SearchableSelects pick up the new option
    revalidatePath('/trips/create');
    revalidatePath('/trips/[id]/edit', 'page');
    revalidatePath('/trips');

    return { success: true, id: Number(id), phone, alternate_phone };
  } catch (err: any) {
    console.error("Create quick profile error", err);
    return { success: false, error: err.message };
  }
}

export async function updateQuickProfile(id: number, name: string, phone: string, alternate_phone?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    await db.query(`
      UPDATE profiles
      SET name = $1, phone = $2, alternate_phone = $3
      WHERE id = $4
    `, [name, phone, alternate_phone || null, id]);

    // Invalidate everything so the SearchableSelects pick up the edited option
    revalidatePath('/trips/create');
    revalidatePath('/trips/[id]/edit', 'page');
    revalidatePath('/trips');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProfile(id: number, formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const dob = formData.get('dob') as string;
  const bio = formData.get('bio') as string;
  const photo = formData.get('photo') as File | null;
  const is_driver = formData.get('is_driver') ? 1 : 0;
  const alternate_phone = formData.get('alternate_phone') as string;

  const role = formData.get('role') as string;
  const password = formData.get('password') as string;

  const age = calculateAge(dob);
  const photo_url = await savePhoto(photo);

  let password_hash = null;
  if (password) {
    password_hash = bcrypt.hashSync(password, 10);
  }

  // Build dynamic UPDATE query
  const updates: string[] = [];
  const params: any[] = [];
  let pIdx = 1;

  updates.push(`name = $${pIdx++}`); params.push(name);
  updates.push(`email = $${pIdx++}`); params.push(email || null);
  updates.push(`phone = $${pIdx++}`); params.push(phone);
  updates.push(`dob = $${pIdx++}`); params.push(dob || null);
  updates.push(`age = $${pIdx++}`); params.push(age);
  updates.push(`bio = $${pIdx++}`); params.push(bio || null);
  updates.push(`is_driver = $${pIdx++}`); params.push(is_driver);
  updates.push(`alternate_phone = $${pIdx++}`); params.push(alternate_phone || null);

  if (photo_url) {
    updates.push(`photo_url = $${pIdx++}`);
    params.push(photo_url);
  }

  if (role) {
    updates.push(`role = $${pIdx++}`);
    params.push(role);
  }

  if (password_hash) {
    updates.push(`password_hash = $${pIdx++}`);
    params.push(password_hash);
  }

  params.push(id); // ID is the last param
  const query = `
    UPDATE profiles
    SET ${updates.join(', ')}
    WHERE id = $${pIdx}
  `;

  await getDb().query(query, params);

  revalidatePath('/');
  revalidatePath(`/profile/${id}`);
  redirect('/');
}

export async function getProfiles(search?: string): Promise<Profile[]> {
  const db = getDb();
  if (search) {
    const term = `%${search}%`;
    const res = await db.query('SELECT * FROM profiles WHERE name ILIKE $1 OR phone ILIKE $2 ORDER BY created_at DESC', [term, term]);
    return res.rows as Profile[];
  }
  const res = await db.query('SELECT * FROM profiles ORDER BY created_at DESC');
  return res.rows as Profile[];
}

export async function getProfile(id: number): Promise<Profile | undefined> {
  const db = getDb();
  const res = await db.query('SELECT * FROM profiles WHERE id = $1', [id]);
  return res.rows[0] as Profile | undefined;
}

// --- VEHICLE ACTIONS ---

export async function createVehicle(formData: FormData) {
  const type = formData.get('type') as string;
  const registration = formData.get('registration') as string;
  const capacity = Number(formData.get('capacity'));
  const make_model = formData.get('make_model') as string;
  const status = formData.get('status') as string;

  const db = getDb();

  try {
    await db.query(`
      INSERT INTO vehicles (type, registration, capacity, make_model, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [type, registration, capacity, make_model, status]);
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      throw new Error('Registration number already exists');
    }
    throw err;
  }

  revalidatePath('/vehicles');
  redirect('/vehicles');
}

export async function updateVehicle(id: number, formData: FormData) {
  const type = formData.get('type') as string;
  const registration = formData.get('registration') as string;
  const capacity = Number(formData.get('capacity'));
  const make_model = formData.get('make_model') as string;
  const status = formData.get('status') as string;

  const db = getDb();

  await db.query(`
    UPDATE vehicles
    SET type = $1, registration = $2, capacity = $3, make_model = $4, status = $5
    WHERE id = $6
  `, [type, registration, capacity, make_model, status, id]);

  revalidatePath('/vehicles');
  revalidatePath(`/vehicles/${id}`);
  redirect('/vehicles');
}

export async function getVehicles(search?: string): Promise<Vehicle[]> {
  const db = getDb();
  if (search) {
    const term = `%${search}%`;
    const res = await db.query('SELECT * FROM vehicles WHERE type ILIKE $1 OR registration ILIKE $2 OR make_model ILIKE $3 ORDER BY created_at DESC', [term, term, term]);
    return res.rows as Vehicle[];
  }
  const res = await db.query('SELECT * FROM vehicles ORDER BY created_at DESC');
  return res.rows as Vehicle[];
}

export async function getVehicle(id: number): Promise<Vehicle | undefined> {
  const db = getDb();
  const res = await db.query('SELECT * FROM vehicles WHERE id = $1', [id]);
  return res.rows[0] as Vehicle | undefined;
}

// --- TRIP ACTIONS ---

export type TripWithDetails = Trip & {
  volunteer_name?: string;
  volunteer_phone?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_registration?: string;
  origin_name?: string;
  destination_name?: string;
};

export async function createTrip(formData: FormData) {
  const session = await getSession();
  if (session?.role !== 'SUPER_ADMIN' && session?.role_id) {
    const { getRolePermissions } = await import('@/lib/rbac-server');
    const permissions = await getRolePermissions(session.role_id);
    if (!permissions['trips']?.edit && !permissions['dashboard']?.edit) {
      throw new Error('Unauthorized. You do not have permission to create trips.');
    }
  }
  const route_code = formData.get('route_code') as string;
  const origin_id = formData.get('origin_id') ? Number(formData.get('origin_id')) : null;
  const origin_venue_id = formData.get('origin_venue_id') ? Number(formData.get('origin_venue_id')) : null;
  const destination_id = formData.get('destination_id') ? Number(formData.get('destination_id')) : null;
  const destination_venue_id = formData.get('destination_venue_id') ? Number(formData.get('destination_venue_id')) : null;
  const region_id = formData.get('region_id') ? Number(formData.get('region_id')) : null;
  const start_time = formData.get('start_time') as string;
  const end_time = formData.get('end_time') as string;
  const vehicle_id = formData.get('vehicle_id') ? Number(formData.get('vehicle_id')) : null;
  const volunteer_id = formData.get('volunteer_id') ? Number(formData.get('volunteer_id')) : null;
  const driver_id = formData.get('driver_id') ? Number(formData.get('driver_id')) : null;
  const status = formData.get('status') as string || 'Planned';
  const sub_status = formData.get('sub_status') as string || 'Scheduled';
  const passengers_boarded = parseInt(formData.get('passengers_boarded') as string) || 0;
  const wheelchairs_boarded = parseInt(formData.get('wheelchairs_boarded') as string) || 0;
  const breakdown_issue = formData.get('breakdown_issue') as string || null;

  const notes = formData.get('notes') as string || null;

  const db = getDb();

  const res = await db.query(`
    INSERT INTO trips (route_code, origin_id, destination_id, origin_venue_id, destination_venue_id, region_id, start_time, end_time, vehicle_id, volunteer_id, driver_id, status, sub_status, breakdown_issue, passengers_boarded, wheelchairs_boarded, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id
  `, [route_code, origin_id, destination_id, origin_venue_id, destination_venue_id, region_id, start_time, end_time, vehicle_id, volunteer_id, driver_id, status, sub_status, breakdown_issue, passengers_boarded, wheelchairs_boarded, notes]);

  const newTripId = res.rows[0].id;

  // Log initial status to history
  await db.query(`
    INSERT INTO trip_status_history (trip_id, status, sub_status, breakdown_issue)
    VALUES ($1, $2, $3, $4)
  `, [newTripId, status, sub_status, breakdown_issue]);

  // Automatically mark the selected volunteer as a driver
  if (driver_id) {
    await db.query('UPDATE profiles SET is_driver = 1 WHERE id = $1', [driver_id]);
  }

  revalidatePath('/trips');
  if (formData.get('no_redirect') === 'true') { return { success: true, error: undefined }; }
  redirect('/trips');
}

export async function updateTrip(id: number, formData: FormData) {
  const session = await getSession();
  if (session?.role !== 'SUPER_ADMIN' && session?.role_id) {
    const { getRolePermissions } = await import('@/lib/rbac-server');
    const permissions = await getRolePermissions(session.role_id);
    if (!permissions['trips']?.edit && !permissions['dashboard']?.edit) {
      throw new Error('Unauthorized. You do not have permission to edit trips.');
    }
  }
  const route_code = formData.get('route_code') as string;
  const origin = formData.get('origin') as string;
  const destination = formData.get('destination') as string;

  // Sanitize dates to ensure Postgres compatibility (strip GMT offsets if needed or use ISO)
  let start_time = formData.get('start_time') as string;
  if (start_time) {
    // If it looks like "Sat Feb 07 2026 ... GMT+0530 ...", convert to ISO
    if (start_time.includes('GMT') || start_time.includes(' (')) {
      start_time = new Date(start_time).toISOString();
    }
  }

  let end_time = formData.get('end_time') as string;
  if (end_time) {
    if (end_time.includes('GMT') || end_time.includes(' (')) {
      end_time = new Date(end_time).toISOString();
    }
  }

  const vehicle_id = formData.get('vehicle_id') ? Number(formData.get('vehicle_id')) : null;
  const volunteer_id = formData.get('volunteer_id') ? Number(formData.get('volunteer_id')) : null;
  const driver_id = formData.get('driver_id') ? Number(formData.get('driver_id')) : null;
  const status = formData.get('status') as string || 'Planned';
  const sub_status = formData.get('sub_status') as string || 'Scheduled';
  const passengers_boarded = parseInt(formData.get('passengers_boarded') as string) || 0;
  const wheelchairs_boarded = parseInt(formData.get('wheelchairs_boarded') as string) || 0;
  const breakdown_issue = formData.get('breakdown_issue') as string || null;

  console.log('UpdateTrip Payload:', {
    id,
    start_time,
    end_time,
    status,
    sub_status,
    origin,
    destination
  });

  const db = getDb();

  // Auto-save locations
  if (origin) {
    await db.query('INSERT INTO locations (name) VALUES ($1) ON CONFLICT DO NOTHING', [origin]);
  }
  if (destination) {
    await db.query('INSERT INTO locations (name) VALUES ($1) ON CONFLICT DO NOTHING', [destination]);
  }

  // Fetch current trip to check for status changes
  const checkRes = await db.query('SELECT status, sub_status, breakdown_issue FROM trips WHERE id = $1', [id]);
  const currentTrip = checkRes.rows[0] as { status: string; sub_status: string; breakdown_issue: string | null } | undefined;

  const origin_id = formData.get('origin_id') ? Number(formData.get('origin_id')) : null;
  const origin_venue_id = formData.get('origin_venue_id') ? Number(formData.get('origin_venue_id')) : null;
  const destination_id = formData.get('destination_id') ? Number(formData.get('destination_id')) : null;
  const destination_venue_id = formData.get('destination_venue_id') ? Number(formData.get('destination_venue_id')) : null;
  const region_id = formData.get('region_id') ? Number(formData.get('region_id')) : null;
  const notes = formData.get('notes') as string || null;

  await db.query(`
    UPDATE trips 
    SET route_code = $1, origin_id = $2, destination_id = $3, origin_venue_id = $4, destination_venue_id = $5, 
        region_id = $6, start_time = $7, end_time = $8, vehicle_id = $9, volunteer_id = $10, driver_id = $11, 
        status = $12, sub_status = $13, breakdown_issue = $14, passengers_boarded = $15, wheelchairs_boarded = $16, notes = $17
    WHERE id = $18
  `, [route_code, origin_id, destination_id, origin_venue_id, destination_venue_id, region_id, start_time, end_time, vehicle_id, volunteer_id, driver_id, status, sub_status, breakdown_issue, passengers_boarded, wheelchairs_boarded, notes, id]);

  // If status, sub_status, or breakdown_issue changed, log to history
  if (
    currentTrip &&
    (currentTrip.status !== status || currentTrip.sub_status !== sub_status || currentTrip.breakdown_issue !== breakdown_issue)
  ) {
    await db.query(`
      INSERT INTO trip_status_history (trip_id, status, sub_status, breakdown_issue)
      VALUES ($1, $2, $3, $4)
    `, [id, status, sub_status, breakdown_issue]);
  }

  // Automatically mark the selected volunteer as a driver
  if (driver_id) {
    await db.query('UPDATE profiles SET is_driver = 1 WHERE id = $1', [driver_id]);
  }

  revalidatePath('/trips');
  revalidatePath(`/trips/${id}`);
  if (formData.get('no_redirect') === 'true') { return { success: true, error: undefined }; }
  redirect('/trips');
}

export async function getLocations(region_id?: number | null): Promise<any[]> {
  const db = getDb();
  let query = `
    SELECT id, name, region_id, 'Location' as type FROM locations
    UNION ALL
    SELECT id * -1 as id, name || ' (Event)' as name, region_id, 'Event' as type FROM events
  `;
  let params: any[] = [];

  if (region_id) {
    query = `
      SELECT id, name, region_id, 'Location' as type FROM locations WHERE region_id = $1
      UNION ALL
      SELECT id * -1 as id, name || ' (Event)' as name, region_id, 'Event' as type FROM events WHERE region_id = $2
    `;
    params.push(region_id, region_id); // both for same param value but different placeholders? No, pg needs distinct params or references
    // Wait, $1 and $2 can be same value.
  }

  query += ' ORDER BY name ASC';

  const res = await db.query(query, params);
  return res.rows as any[];
}

export async function getTrips(search?: string, region_id?: number | null, limit?: number, offset?: number, dashboardMode?: boolean, status?: string | string[] | null, historyDays?: number): Promise<any[]> {
  const db = getDb();
  let baseQuery = `
    SELECT trips.*, 
           v.name as volunteer_name, v.phone as volunteer_phone,
           d.name as driver_name, d.phone as driver_phone,
           vehicles.registration as vehicle_registration,
           COALESCE(loc_o.name, ven_o.name) as origin_name,
           COALESCE(loc_d.name, ven_d.name) as destination_name,
           ven_o.name as origin_venue_name,
           ven_d.name as destination_venue_name
    FROM trips 
    LEFT JOIN profiles v ON trips.volunteer_id = v.id 
    LEFT JOIN profiles d ON trips.driver_id = d.id 
    LEFT JOIN vehicles ON trips.vehicle_id = vehicles.id
    LEFT JOIN locations loc_o ON trips.origin_id = loc_o.id
    LEFT JOIN locations loc_d ON trips.destination_id = loc_d.id
    LEFT JOIN venues ven_o ON trips.origin_venue_id = ven_o.id OR loc_o.venue_id = ven_o.id
    LEFT JOIN venues ven_d ON trips.destination_venue_id = ven_d.id OR loc_d.venue_id = ven_d.id
  `;

  let conditions: string[] = [];
  let params: any[] = [];
  let pIdx = 1;

  if (region_id) {
    conditions.push(`trips.region_id = $${pIdx++}`);
    params.push(region_id);
  }

  if (status) {
    if (Array.isArray(status)) {
      if (status.length > 0) {
        // Create ($1, $2, $3) style placeholder
        const placeholders = status.map(() => `$${pIdx++}`).join(', ');
        conditions.push(`trips.status IN (${placeholders})`);
        params.push(...status);
      }
    } else {
      // Handle comma-separated string if passed as string "Active,Arriving" (common in URL queries)
      if (status.includes(',')) {
        const statuses = status.split(',');
        const placeholders = statuses.map(() => `$${pIdx++}`).join(', ');
        conditions.push(`trips.status IN (${placeholders})`);
        params.push(...statuses);
      } else {
        conditions.push(`trips.status = $${pIdx++}`);
        params.push(status);
      }
    }
  }

  if (dashboardMode) {
    // Only display active monitor types, or recently completed/cancelled ones to save massive memory
    const days = historyDays === undefined ? 7 : historyDays;

    if (days === -1) {
      // Show ALL history for Completed/Cancelled/Planned
      conditions.push(`(trips.status IN ('Active', 'Arriving', 'Scheduled', 'Breakdown', 'Completed', 'Cancelled', 'Planned'))`);
    } else {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(`(trips.status IN ('Active', 'Arriving', 'Scheduled', 'Breakdown') OR (trips.status IN ('Completed', 'Cancelled', 'Planned') AND trips.start_time > $${pIdx++}))`);
      params.push(cutoffDate.toISOString());
    }
  }

  if (search) {
    const terms = search.trim().split(/\s+/);
    terms.forEach(t => {
      const term = `%${t}%`;
      // ILIKE for case insensitive
      conditions.push(`(trips.route_code ILIKE $${pIdx} OR loc_o.name ILIKE $${pIdx} OR loc_d.name ILIKE $${pIdx} OR ven_o.name ILIKE $${pIdx} OR ven_d.name ILIKE $${pIdx} OR v.name ILIKE $${pIdx} OR v.phone ILIKE $${pIdx} OR d.name ILIKE $${pIdx} OR d.phone ILIKE $${pIdx} OR vehicles.registration ILIKE $${pIdx} OR CAST(trips.start_time AS TEXT) ILIKE $${pIdx})`);
      params.push(term);
      pIdx++;
    });
  }

  if (conditions.length > 0) {
    baseQuery += ' WHERE ' + conditions.join(' AND ');
  }

  baseQuery += ' ORDER BY trips.start_time DESC';

  if (limit !== undefined && offset !== undefined) {
    baseQuery += ` LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    params.push(limit, offset);
  }

  const res = await db.query(baseQuery, params);
  return res.rows as any[];
}

export async function getTripsCount(search?: string, region_id?: number | null, dashboardMode?: boolean, status?: string | string[] | null, historyDays?: number): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const db = getDb();
  let baseQuery = 'SELECT COUNT(*) as count FROM trips';
  const conditions: string[] = [];
  const params: any[] = [];
  let pIdx = 1;

  // Determine if joins are needed for search or dashboardMode
  let needsJoins = false;
  if (search || dashboardMode) {
    needsJoins = true;
  }

  if (needsJoins) {
    baseQuery += `
      LEFT JOIN profiles v ON trips.volunteer_id = v.id
      LEFT JOIN profiles d ON trips.driver_id = d.id
      LEFT JOIN vehicles ON trips.vehicle_id = vehicles.id
      LEFT JOIN locations loc_o ON trips.origin_id = loc_o.id
      LEFT JOIN locations loc_d ON trips.destination_id = loc_d.id
      LEFT JOIN venues ven_o ON trips.origin_venue_id = ven_o.id OR loc_o.venue_id = ven_o.id
      LEFT JOIN venues ven_d ON trips.destination_venue_id = ven_d.id OR loc_d.venue_id = ven_d.id
    `;
  }

  if (region_id) {
    conditions.push(`trips.region_id = $${pIdx++}`);
    params.push(region_id);
  }

  if (status) {
    if (Array.isArray(status)) {
      if (status.length > 0) {
        const placeholders = status.map(() => `$${pIdx++}`).join(', ');
        conditions.push(`trips.status IN (${placeholders})`);
        params.push(...status);
      }
    } else {
      if (status.includes(',')) {
        const statuses = status.split(',');
        const placeholders = statuses.map(() => `$${pIdx++}`).join(', ');
        conditions.push(`trips.status IN (${placeholders})`);
        params.push(...statuses);
      } else {
        conditions.push(`trips.status = $${pIdx++}`);
        params.push(status);
      }
    }
  }

  if (dashboardMode) {
    const days = historyDays === undefined ? 7 : historyDays;

    if (days === -1) {
      conditions.push(`(trips.status IN ('Active', 'Arriving', 'Scheduled', 'Breakdown', 'Completed', 'Cancelled', 'Planned'))`);
    } else {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(`(trips.status IN ('Active', 'Arriving', 'Scheduled', 'Breakdown') OR (trips.status IN ('Completed', 'Cancelled', 'Planned') AND trips.start_time > $${pIdx++}))`);
      params.push(cutoffDate.toISOString());
    }
  }

  if (search) {
    const terms = search.trim().split(/\s+/);
    terms.forEach(t => {
      const term = `%${t}%`;
      conditions.push(`(trips.route_code ILIKE $${pIdx} OR loc_o.name ILIKE $${pIdx} OR loc_d.name ILIKE $${pIdx} OR ven_o.name ILIKE $${pIdx} OR ven_d.name ILIKE $${pIdx} OR v.name ILIKE $${pIdx} OR v.phone ILIKE $${pIdx} OR d.name ILIKE $${pIdx} OR d.phone ILIKE $${pIdx} OR vehicles.registration ILIKE $${pIdx} OR CAST(trips.start_time AS TEXT) ILIKE $${pIdx})`);
      params.push(term);
      pIdx++;
    });
  }

  if (conditions.length > 0) {
    baseQuery += ' WHERE ' + conditions.join(' AND ');
  }

  const res = await db.query(baseQuery, params);
  return Number(res.rows[0].count);
}

export async function getTrip(id: number): Promise<any | undefined> {
  const db = getDb();
  const res = await db.query(`
    SELECT trips.*, 
           loc_o.name as origin_name,
           loc_d.name as destination_name,
           ven_o.name as origin_venue_name,
           ven_d.name as destination_venue_name
    FROM trips 
    LEFT JOIN locations loc_o ON trips.origin_id = loc_o.id
    LEFT JOIN locations loc_d ON trips.destination_id = loc_d.id
    LEFT JOIN venues ven_o ON trips.origin_venue_id = ven_o.id OR loc_o.venue_id = ven_o.id
    LEFT JOIN venues ven_d ON trips.destination_venue_id = ven_d.id OR loc_d.venue_id = ven_d.id
    WHERE trips.id = $1
  `, [id]);
  return res.rows[0];
}

// --- TRIP SUB-STATUS ACTIONS ---

export async function getTripStatuses() {
  const db = getDb();
  const res = await db.query('SELECT * FROM trip_statuses ORDER BY sort_order ASC');
  return res.rows as { id: number, name: string, passenger_count_required: number, sort_order: number }[];
}

export async function createTripStatus(formData: FormData) {
  const name = formData.get('name') as string;
  const passenger_count_required = formData.get('passenger_count_required') === 'true' ? 1 : 0;
  const sort_order = Number(formData.get('sort_order')) || 0;

  const db = getDb();
  try {
    const res = await db.query('INSERT INTO trip_statuses (name, passenger_count_required, sort_order) VALUES ($1, $2, $3) RETURNING id', [name, passenger_count_required, sort_order]);
    return { success: true, id: res.rows[0].id };
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      return { success: false, error: 'Status name already exists' };
    }
    return { success: false, error: err.message };
  }
}

export async function updateTripStatus(id: number, formData: FormData) {
  const name = formData.get('name') as string;
  const passenger_count_required = formData.get('passenger_count_required') === 'true' ? 1 : 0;
  const sort_order = Number(formData.get('sort_order')) || 0;

  const db = getDb();

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const getOldRes = await client.query('SELECT name FROM trip_statuses WHERE id = $1', [id]);
    const getOld = getOldRes.rows[0] as { name: string };

    await client.query('UPDATE trip_statuses SET name = $1, passenger_count_required = $2, sort_order = $3 WHERE id = $4', [name, passenger_count_required, sort_order, id]);

    // Cascade this name change to sub-statuses and active trips
    if (getOld && getOld.name !== name) {
      await client.query('UPDATE trip_sub_statuses SET linked_status = $1 WHERE linked_status = $2', [name, getOld.name]);
      await client.query('UPDATE trips SET status = $1 WHERE status = $2', [name, getOld.name]);
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message.includes('unique constraint') || err.code === '23505') {
      return { success: false, error: 'Status name already exists' };
    }
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

export async function deleteTripStatus(id: number) {
  const db = getDb();
  const getOldRes = await db.query('SELECT name FROM trip_statuses WHERE id = $1', [id]);
  const getOld = getOldRes.rows[0] as { name: string };

  try {
    await db.query('DELETE FROM trip_statuses WHERE id = $1', [id]);
    // Optionally un-link sub-statuses
    if (getOld) {
      await db.query('UPDATE trip_sub_statuses SET linked_status = \'\' WHERE linked_status = $1', [getOld.name]);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTripSubStatuses(): Promise<TripSubStatus[]> {
  const db = getDb();
  const res = await db.query('SELECT * FROM trip_sub_statuses ORDER BY sort_order ASC');
  return res.rows as TripSubStatus[];
}

export async function createTripSubStatus(formData: FormData) {
  const name = formData.get('name') as string;
  const linked_status = formData.get('linked_status') as string;
  const sort_order = Number(formData.get('sort_order')) || 0;

  const db = getDb();

  try {
    await db.query('INSERT INTO trip_sub_statuses (name, linked_status, sort_order) VALUES ($1, $2, $3)', [name, linked_status, sort_order]);

    revalidatePath('/settings/statuses');
    revalidatePath('/trips/create');
    revalidatePath('/trips');

    return { success: true };
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      return { success: false, error: 'Sub-status name already exists' };
    }
    return { success: false, error: err.message };
  }
}

export async function deleteTripSubStatus(id: number) {
  const db = getDb();
  await db.query('DELETE FROM trip_sub_statuses WHERE id = $1', [id]);

  revalidatePath('/settings/statuses');
  revalidatePath('/trips/create');
  revalidatePath('/trips');
}

// App Settings
export async function getAppSetting(key: string): Promise<string | null> {
  const db = getDb();
  const res = await db.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  const result = res.rows[0] as { value: string } | undefined;
  return result ? result.value : null;
}

export async function updateTimezone(timezone: string) {
  const db = getDb();
  await db.query('INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['timezone', timezone]);
  revalidatePath('/dashboard');
  revalidatePath('/settings/statuses');
}

export async function updateTripSubStatus(id: number, formData: FormData) {
  const name = formData.get('name') as string;
  const linked_status = formData.get('linked_status') as string;
  const sort_order = Number(formData.get('sort_order')) || 0;

  const db = getDb();

  try {
    await db.query('UPDATE trip_sub_statuses SET name = $1, linked_status = $2, sort_order = $3 WHERE id = $4', [name, linked_status, sort_order, id]);
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      return { success: false, error: 'Sub-status name already exists' };
    }
    return { success: false, error: err.message };
  }

  revalidatePath('/settings/statuses');
  revalidatePath('/trips/create');
  revalidatePath('/trips');
  return { success: true };
}

export async function createQuickVehicle(registration: string, type: string, capacity: number): Promise<{ success: boolean; id?: number; error?: string; registration?: string }> {
  try {
    const db = getDb();
    const res = await db.query(`
      INSERT INTO vehicles (type, registration, capacity, make_model, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [type, registration, capacity || 0, '', 'Active']);

    // Note: SQLite defaulted status to Active, but Insert query in QuickVehicle didn't specify it, relying on default.
    // Postgres default works if we omit the column, but here I added it to be safe or I should check the schema default.
    // Schema says DEFAULT 'Active', so I can omit it or pass it. I passed 5 params.

    return {
      success: true,
      id: Number(res.rows[0].id),
      registration
    };
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      return { success: false, error: 'A vehicle with this registration already exists' };
    }
    return { success: false, error: err.message };
  }
}

export async function updateQuickVehicle(id: number, registration: string, type: string, capacity: number) {
  try {
    const db = getDb();
    await db.query('UPDATE vehicles SET registration = $1, type = $2, capacity = $3 WHERE id = $4', [registration, type, capacity || 0, id]);
    return { success: true };
  } catch (error: any) {
    if (error.message.includes('unique constraint') || error.code === '23505') {
      return { success: false, error: 'Registration number already exists.' };
    }
    return { success: false, error: 'Database error occurred' };
  }
}

export async function getVolunteerTrips(location_id: number): Promise<any[]> {
  const db = getDb();
  let query = `
    SELECT trips.*, 
           v.name as volunteer_name, v.phone as volunteer_phone,
           d.name as driver_name, d.phone as driver_phone,
           vehicles.registration as vehicle_registration,
           COALESCE(loc_o.name, ven_o.name) as origin_name,
           COALESCE(loc_d.name, ven_d.name) as destination_name,
           ven_o.name as origin_venue_name,
           ven_d.name as destination_venue_name
    FROM trips 
    LEFT JOIN profiles v ON trips.volunteer_id = v.id 
    LEFT JOIN profiles d ON trips.driver_id = d.id 
    LEFT JOIN vehicles ON trips.vehicle_id = vehicles.id
    LEFT JOIN locations loc_o ON trips.origin_id = loc_o.id
    LEFT JOIN locations loc_d ON trips.destination_id = loc_d.id
    LEFT JOIN venues ven_o ON trips.origin_venue_id = ven_o.id OR loc_o.venue_id = ven_o.id
    LEFT JOIN venues ven_d ON trips.destination_venue_id = ven_d.id OR loc_d.venue_id = ven_d.id
    WHERE trips.origin_id = $1 OR trips.destination_id = $2 OR trips.origin_venue_id = $3 OR trips.destination_venue_id = $4
    ORDER BY trips.start_time DESC
  `;

  const res = await db.query(query, [location_id, location_id, location_id, location_id]);
  return res.rows as any[];
}


export async function updateTripProgress(id: number, status: string, sub_status?: string, breakdown_issue?: string) {
  const safeSubStatus = sub_status || ''; // Empty string instead of null for constraint
  const safeBreakdownIssue = breakdown_issue || null;

  const db = getDb();
  await db.query('UPDATE trips SET status = $1, sub_status = $2, breakdown_issue = $3 WHERE id = $4', [status, safeSubStatus, safeBreakdownIssue, id]);

  // Log to history
  await db.query(`
    INSERT INTO trip_status_history (trip_id, status, sub_status, breakdown_issue)
    VALUES ($1, $2, $3, $4)
  `, [id, status, safeSubStatus, safeBreakdownIssue]);

  revalidatePath('/my-location-trips');
  revalidatePath('/trips');
}

export async function getHierarchyData() {
  const db = getDb();
  const regionsRes = await db.query('SELECT * FROM regions');
  const venuesRes = await db.query('SELECT * FROM venues');
  const locationsRes = await db.query('SELECT * FROM locations');
  return { regions: regionsRes.rows, venues: venuesRes.rows, locations: locationsRes.rows };
}

// Trips Delete
export async function deleteTrip(id: number) {
  const session = await getSession();
  if (session?.role !== 'SUPER_ADMIN' && session?.role_id) {
    const { getRolePermissions } = await import('@/lib/rbac-server');
    const permissions = await getRolePermissions(session.role_id);
    if (!permissions['trips']?.edit) {
      return { success: false, error: 'Unauthorized. You do not have permission to delete trips.' };
    }
  }

  const db = getDb();

  try {
    // Clean up history FIRST due to foreign key constraints
    await db.query('DELETE FROM trip_status_history WHERE trip_id = $1', [id]);
    await db.query('DELETE FROM trips WHERE id = $1', [id]);

    revalidatePath('/trips');
    revalidatePath('/manage-trips');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- RBAC ACTIONS ---

export async function getRoles() {
  const db = getDb();
  const res = await db.query('SELECT * FROM roles ORDER BY name ASC');
  return res.rows as any[];
}

export async function createRole(name: string, description: string) {
  const db = getDb();
  try {
    const res = await db.query('INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id', [name, description]);
    revalidatePath('/settings/roles');
    return { success: true, id: res.rows[0].id };
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.code === '23505') {
      return { success: false, error: 'Role name already exists' };
    }
    return { success: false, error: err.message };
  }
}

export async function deleteRole(id: number) {
  const db = getDb();
  const checkRes = await db.query('SELECT is_system_role FROM roles WHERE id = $1', [id]);
  const check = checkRes.rows[0];

  if (check && check.is_system_role) {
    return { success: false, error: 'Cannot delete system roles' };
  }

  if (!check) return { success: false, error: 'Role not found' };

  try {
    await db.query('DELETE FROM roles WHERE id = $1', [id]);
    revalidatePath('/settings/roles');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function quickUpdateTripDetails(
  id: number,
  volunteer_id: number | null,
  driver_id: number | null,
  registration: string,
  passengers: number,
  wheelchairs: number,
  notes: string
) {
  const db = getDb();

  let vehicle_id: number | null = null;
  if (registration) {
    const vehRes = await db.query('SELECT id FROM vehicles WHERE registration = $1', [registration]);
    let veh = vehRes.rows[0];
    if (!veh) {
      // Auto-create vehicle if not exists? Or just fail?
      // For quick update, maybe auto-create is better UX or we assume it exists.
      // Let's safe fail for now or create.
      // Given the context "Quick Add", likely we want to create if missing or just return error.
      // Let's create it as Active.
      const createRes = await db.query('INSERT INTO vehicles (type, registration, capacity, make_model, status) VALUES ($1, $2, $3, $4, $5) RETURNING id', ['Bus', registration, 0, 'Unknown', 'Active']);
      veh = createRes.rows[0];
    }
    vehicle_id = veh.id;
  }

  await db.query(`
    UPDATE trips 
    SET volunteer_id = $1, driver_id = $2, vehicle_id = $3, passengers_boarded = $4, wheelchairs_boarded = $5, notes = $6
    WHERE id = $7
  `, [volunteer_id, driver_id, vehicle_id, passengers, wheelchairs, notes || null, id]);

  if (driver_id) {
    await db.query('UPDATE profiles SET is_driver = 1 WHERE id = $1', [driver_id]);
  }

  revalidatePath('/trips');
  revalidatePath(`/trips/${id}`);
  revalidatePath('/my-location-trips');
}

export async function updateRolePermissions(roleId: number, permissions: { module_code: string, can_view: boolean, can_edit: boolean }[]) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Delete existing permissions
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    // Insert new permissions
    for (const p of permissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, module_code, can_view, can_edit)
        VALUES ($1, $2, $3, $4)
      `, [roleId, p.module_code, p.can_view ? 1 : 0, p.can_edit ? 1 : 0]);
    }

    await client.query('COMMIT');
    revalidatePath('/settings/roles');
    return { success: true };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}
