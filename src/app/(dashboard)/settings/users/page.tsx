import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import UserManagementClient from './UserManagementClient';
import { User, Region, Location, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await getSession();
  
  // Check for permission 'users.view' OR 'settings.view' (since it was under Admin)
  // Or just 'users.view' as per the module definition.
  const permissions = session?.permissions || {};
  const canViewUsers = session?.role === 'SUPER_ADMIN' || permissions['users']?.view;

  if (!canViewUsers) {
    return notFound();
  }

  const db = getDb();
  
  let usersQuery = `
    SELECT u.id, u.name, u.email, u.role, u.role_id, u.region_id, u.location_id, u.created_at, r.name as region_name, 
           COALESCE(l.name, ev.name || ' (Event)') as location_name 
    FROM users u
    LEFT JOIN regions r ON u.region_id = r.id
    LEFT JOIN locations l ON u.location_id = l.id AND u.location_id > 0
    LEFT JOIN events ev ON (u.location_id * -1) = ev.id AND u.location_id < 0
  `;
  const queryParams: any[] = [];

  // Scoping: If not SUPER_ADMIN and has region_id, filter by region
  if (session?.role !== 'SUPER_ADMIN' && session?.region_id) {
    usersQuery += ` WHERE u.region_id = $1`;
    queryParams.push(session.region_id);
  }

  usersQuery += ` ORDER BY u.created_at DESC`;

  const usersRes = await db.query(usersQuery, queryParams);
  const users = usersRes.rows as (User & { region_name?: string, location_name?: string })[];

  // Filter Regions
  let regionsQuery = 'SELECT * FROM regions';
  let regionsParams: any[] = [];
  if (session?.role !== 'SUPER_ADMIN' && session?.region_id) {
    regionsQuery += ' WHERE id = $1';
    regionsParams.push(session.region_id);
  }
  const regionsRes = await db.query(regionsQuery, regionsParams);
  const regions = regionsRes.rows as Region[];

  const rolesRes = await db.query('SELECT * FROM roles ORDER BY name ASC');
  const roles = rolesRes.rows;

  // Filter Locations
  let locationsQuery = 'SELECT id, name, region_id, venue_id FROM locations';
  let locationsParams: any[] = [];
  if (session?.role !== 'SUPER_ADMIN' && session?.region_id) {
    locationsQuery += ' WHERE region_id = $1';
    locationsParams.push(session.region_id);
  }
  const locationsRes = await db.query(locationsQuery, locationsParams);
  const locations = locationsRes.rows as Location[];
  
  // db.close(); // Database is a singleton now, do not close

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' }}>System Users</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Manage administrator, dispatch, and bus incharge login access.</p>
        </div>
      </div>
      
      <UserManagementClient
        initialUsers={users}
        regions={regions}
        locations={locations}
        availableRoles={roles}
        currentUserRole={session?.role || ''}
        currentUserPermissions={permissions}
      />
    </div>
  );
}
