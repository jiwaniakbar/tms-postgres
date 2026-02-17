import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Region, Venue, Location, getDb } from '@/lib/db';
import HierarchyManagerClient from './HierarchyManagerClient';

export const dynamic = 'force-dynamic';

export default async function HierarchyPage() {
  const session = await getSession();
  
  // Check permissions
  const permissions = session?.permissions || {};
  // Assuming 'settings' module controls access to this page, or we check if they are explicitly allowed.
  // Previously strict check: if (session?.role !== 'SUPER_ADMIN' && session?.role !== 'REGION_ADMIN')
  // New check: Super Admin OR Region Admin OR has settings.view permission
  const canViewRegions = session?.role === 'SUPER_ADMIN' || session?.role === 'REGION_ADMIN' || permissions['settings']?.view;

  if (!canViewRegions) {
    return notFound();
  }

  const db = getDb();
  
  let regionsStmt = 'SELECT * FROM regions ORDER BY id ASC';
  let venuesStmt = 'SELECT * FROM venues ORDER BY id ASC';
  let locationsStmt = 'SELECT * FROM locations ORDER BY id ASC';
  
  let regionParams: any[] = [];
  let venueParams: any[] = [];
  let locationParams: any[] = [];

  // Scoping: If not SUPER_ADMIN and has region_id, filter by region
  if (session.role !== 'SUPER_ADMIN' && session.region_id) {
    regionsStmt = 'SELECT * FROM regions WHERE id = $1 ORDER BY id ASC';
    regionParams = [session.region_id];

    venuesStmt = 'SELECT * FROM venues WHERE region_id = $1 ORDER BY id ASC';
    venueParams = [session.region_id];

    locationsStmt = 'SELECT * FROM locations WHERE region_id = $1 ORDER BY id ASC';
    locationParams = [session.region_id];
  }

  const regionsRes = await db.query(regionsStmt, regionParams);
  const regions = regionsRes.rows as Region[];

  const venuesRes = await db.query(venuesStmt, venueParams);
  const venues = venuesRes.rows as Venue[];

  const locationsRes = await db.query(locationsStmt, locationParams);
  const locations = locationsRes.rows as Location[];
  
  // db.close(); // Database is a singleton now, do not close

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' }}>Spatial Hierarchy</h1>
        <p style={{ color: '#64748b', margin: 0 }}>Configure Regions, Venues, and specific mapping Locations.</p>
      </div>
      
      <HierarchyManagerClient 
        initialRegions={regions} 
        initialVenues={venues} 
        initialLocations={locations}
         
        userRole={session.role}
      />
    </div>
  );
}
