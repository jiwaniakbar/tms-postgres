
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

export async function seedData(pool: Pool) {
  console.log('Seeding data...');

  // 1. ROLES
  const roles = [
    { name: 'Super Admin', description: 'Full system access', is_system_role: 1 },
    { name: 'Region Admin', description: 'Manage specific region', is_system_role: 0 },
    { name: 'Command Center', description: 'Monitor and manage trips', is_system_role: 0 },
    { name: 'Trip Admin', description: 'Manage trips', is_system_role: 0 },
    { name: 'Bus Incharge', description: 'Manage vehicle and passengers', is_system_role: 0 },
    { name: 'Volunteer', description: 'General volunteer', is_system_role: 0 }
  ];

  for (const role of roles) {
    await pool.query(
      'INSERT INTO roles (name, description, is_system_role) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [role.name, role.description, role.is_system_role]
    );
  }

  // 2. REGIONS & LOCATIONS
  // Default Region
  const defaultRegionRes = await pool.query(
    "INSERT INTO regions (name) VALUES ('Default Region') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id"
  );
  const regionId = defaultRegionRes.rows[0].id;

  // Default Locations
  const locations = [
    'Airport Terminal 1',
    'Airport Terminal 2',
    'Main Station',
    'City Center',
    'Hotel Grand',
    'Convention Center'
  ];

  for (const loc of locations) {
    await pool.query(
      'INSERT INTO locations (name, region_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [loc, regionId]
    );
  }

  // Default Headquarter Venue
  const venueRes = await pool.query(
    "INSERT INTO venues (name, region_id) VALUES ('Main Headquarters', $1) ON CONFLICT DO NOTHING RETURNING id",
    [regionId]
  );

  if (venueRes.rows.length > 0) {
    const venueId = venueRes.rows[0].id;
    // Add a dropoff for this venue
    await pool.query(
      'INSERT INTO locations (name, venue_id, region_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      ['HQ Entrance', venueId, regionId]
    );
  }


  // 3. TRIP STATUSES (Progress)
  const statuses = [
    { name: 'Scheduled', passenger_required: 0, sort_order: 10 },
    { name: 'Arriving', passenger_required: 0, sort_order: 20 },
    { name: 'Active', passenger_required: 1, sort_order: 30 },
    { name: 'Completed', passenger_required: 0, sort_order: 40 },
    { name: 'Cancelled', passenger_required: 0, sort_order: 50 },
    { name: 'Breakdown', passenger_required: 0, sort_order: 60 }
  ];

  for (const s of statuses) {
    await pool.query(
      'INSERT INTO trip_statuses (name, passenger_count_required, sort_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET passenger_count_required = $2, sort_order = $3',
      [s.name, s.passenger_required, s.sort_order]
    );
  }

  // 4. SUB-STATUSES
  const subStatuses = [
    { name: 'Planned', linked: 'Scheduled', sort: 10 },
    { name: 'Ready for Onboarding', linked: 'Scheduled', sort: 20 },
    { name: 'Perimeter - 1 km', linked: 'Arriving', sort: 10 },
    { name: 'Perimeter - 2 km', linked: 'Arriving', sort: 20 },
    { name: 'Boarding', linked: 'Active', sort: 10 },
    { name: 'In Transit', linked: 'Active', sort: 20 },
    { name: 'At pit stop', linked: 'Active', sort: 30 },
    { name: 'Arrived', linked: 'Completed', sort: 10 },
    { name: 'Parked', linked: 'Completed', sort: 20 }
  ];

  for (const ss of subStatuses) {
    await pool.query(
      'INSERT INTO trip_sub_statuses (name, linked_status, sort_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET linked_status = $2, sort_order = $3',
      [ss.name, ss.linked, ss.sort]
    );
  }

  // 5. SUPER ADMIN USER (if not exists)
  // Check if any user exists
  const userCheck = await pool.query('SELECT count(*) as count FROM users');
  if (userCheck.rows[0].count === '0') {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Get Super Admin Role ID
    const roleRes = await pool.query("SELECT id FROM roles WHERE name = 'Super Admin'");
    const roleId = roleRes.rows[0]?.id;

    if (roleId) {
      await pool.query(`
            INSERT INTO users (name, email, password_hash, role, role_id, region_id)
            VALUES ('System Administrator', 'admin@jk.com', $1, 'SUPER_ADMIN', $2, $3)
          `, [hashedPassword, roleId, regionId]);
      console.log('Created default Super Admin user: admin@jk.com / admin123');
    }
  }

  console.log('Seeding completed.');
}
