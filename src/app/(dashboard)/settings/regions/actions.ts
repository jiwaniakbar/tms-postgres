'use server';
import { getDb } from '@/lib/db';

export async function createRegion(name: string): Promise<{success: boolean, id?: number, error?: string}> {
  const db = getDb();
  try {
    const res = await db.query('INSERT INTO regions (name) VALUES ($1) RETURNING id', [name]);
    return { success: true, id: Number(res.rows[0].id) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createVenue(name: string, region_id: number): Promise<{success: boolean, id?: number, error?: string}> {
  const db = getDb();
  try {
    const res = await db.query('INSERT INTO venues (name, region_id) VALUES ($1, $2) RETURNING id', [name, region_id]);
    return { success: true, id: Number(res.rows[0].id) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createLocation(name: string, venue_id: number | null, region_id: number): Promise<{success: boolean, id?: number, error?: string}> {
  const db = getDb();
  try {
    const res = await db.query('INSERT INTO locations (name, venue_id, region_id) VALUES ($1, $2, $3) RETURNING id', [name, venue_id, region_id]);
    return { success: true, id: Number(res.rows[0].id) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


export async function createEvent(name: string, region_id: number) {
  const db = getDb();
  try {
    const res = await db.query('INSERT INTO events (name, region_id) VALUES ($1, $2) RETURNING id', [name, region_id]);
    return { success: true, id: Number(res.rows[0].id) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteEntity(table: string, id: number) {
  if (!['regions', 'venues', 'locations'].includes(table)) return { success: false, error: 'Invalid table' };
  
  const db = getDb();
  
  try {
    // Note: Postgres enforces Foreign Keys by default, no need for pragma foreign_keys = ON

    if (table === 'regions') {
      const tripsCountRes = await db.query('SELECT COUNT(*) as c FROM trips WHERE region_id = $1', [id]);
      const tripsCount = Number(tripsCountRes.rows[0].c);
      if (tripsCount > 0) throw new Error(`Cannot delete Region. It has ${tripsCount} active Trips attached.`);
    }

    if (table === 'locations') {
      const tripsORes = await db.query('SELECT COUNT(*) as c FROM trips WHERE origin_id = $1', [id]);
      const tripsCountO = Number(tripsORes.rows[0].c);
      const tripsDRes = await db.query('SELECT COUNT(*) as c FROM trips WHERE destination_id = $1', [id]);
      const tripsCountD = Number(tripsDRes.rows[0].c);

      if (tripsCountO > 0 || tripsCountD > 0) {
         throw new Error('Cannot delete this Location/Drop-off. It is currently acting as an Origin or Destination for an existing Trip.');
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      if (table === 'regions') {
          const venuesRes = await client.query('SELECT id FROM venues WHERE region_id = $1', [id]);
          const venues = venuesRes.rows;
          for (const ven of venues) {
              await client.query('DELETE FROM locations WHERE venue_id = $1', [ven.id]);
            }
          await client.query('DELETE FROM venues WHERE region_id = $1', [id]);
          await client.query('DELETE FROM locations WHERE region_id = $1 AND venue_id IS NULL', [id]);
          await client.query('DELETE FROM regions WHERE id = $1', [id]);

        } else if (table === 'venues') {
          const tripsORes = await client.query('SELECT COUNT(*) as c FROM trips WHERE origin_venue_id = $1', [id]);
          const tripsCountO = Number(tripsORes.rows[0].c);
          const tripsDRes = await client.query('SELECT COUNT(*) as c FROM trips WHERE destination_venue_id = $1', [id]);
          const tripsCountD = Number(tripsDRes.rows[0].c);

          if (tripsCountO > 0 || tripsCountD > 0) {
            throw new Error('Cannot delete this Venue. Trips are currently routed directly to it.');
          }
          await client.query('DELETE FROM locations WHERE venue_id = $1', [id]);
          await client.query('DELETE FROM venues WHERE id = $1', [id]);

        } else {
          // Safe to string interpolate table here because we validated it against allowlist at the top
          await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
        }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return { success: true };
  } catch (e: any) {
    if (e.message.includes('foreign key constraint') || e.code === '23503') {
      return { success: false, error: 'Cannot delete: this item contains active trips or is protected by critical system data.' };
    }
    return { success: false, error: e.message };
  }
}

export async function updateEntity(table: string, id: number, name: string) {
  if (!['regions', 'venues', 'locations'].includes(table)) return { success: false, error: 'Invalid table' };

  const db = getDb();
  
  try {
    // Safe interpolation of table name due to whitelist check
    await db.query(`UPDATE ${table} SET name = $1 WHERE id = $2`, [name, id]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
