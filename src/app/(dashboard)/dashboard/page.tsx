export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { getTrips, getVehicles, getProfiles, getTripSubStatuses, getLocations, getTripStatuses, getHierarchyData } from '@/app/actions';
import DashboardClient from './DashboardClient';
import RefreshControl from '@/components/RefreshControl';
import DashboardHistoryFilter from '@/components/DashboardHistoryFilter';
import { getSession } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { getRolePermissions } from '@/lib/rbac-server';

export default async function DashboardPage(props: {
  searchParams: Promise<{ status?: string, historyDays?: string }>;
}) {
  const searchParams = await props.searchParams;
  // Handle status as array (comma separated string in URL)
  const rawStatus = searchParams.status;
  let selectedStatuses: string[] = [];
  if (rawStatus) {
    selectedStatuses = rawStatus.split(',').filter(Boolean);
  }

  const historyDays = searchParams.historyDays ? parseInt(searchParams.historyDays) : 7;
  const session = await getSession();
  
  if (!session) redirect('/login');

  if (session.role !== 'SUPER_ADMIN') {
    const permissions = await getRolePermissions(session.role_id);
    if (!permissions['dashboard']?.view) {
      if (permissions['trips']?.view) {
        redirect('/manage-trips');
      } else {
        redirect('/my-location-trips');
      }
    }
  }

  // Fetch only relevant dashboard trips
  // Pass historyDays and potentially array of statuses to getTrips
  // Note: getTrips now handles comma-separated string or array. We pass rawStatus string.
  // The user wants KPI counts to be STATIC. 
  // So we must fetch ALL trips in history window (no status filter) for counts, 
  // and then filter client-side or use the same list if we want to save DB calls.
  // Previously we called getTrips with undefined status!
  // Let's revert passing rawStatus to getTrips if we want static counts!
  // We should pass undefined for status to getTrips to get ALL trips in window, then filter for display.

  const allHistoryTrips = await getTrips('', null, undefined, undefined, true, undefined, historyDays);

  const vehicles = await getVehicles();
  const volunteers = await getProfiles();
  const subStatuses = await getTripSubStatuses();
  const locations = await getLocations();
  const statuses = await getTripStatuses();
  const hierarchy = await getHierarchyData();
  
  const activeStatusNames = statuses.map(s => s.name);
  // Base set of trips for the dashboard (respecting history limit from getTrips)
  const allDashboardTrips = allHistoryTrips.filter(t => activeStatusNames.includes(t.status) || t.status === 'Planned');

  // Filtered set for the list view (respecting status selection)
  let displayedTrips = allDashboardTrips;
  if (selectedStatuses.length > 0) {
    displayedTrips = displayedTrips.filter(t => selectedStatuses.includes(t.status));
  }
  
  const statusOrder: { [key: string]: number } = { 'Breakdown': 1, 'Arriving': 2, 'Active': 3, 'Scheduled': 4, 'Completed': 5 };
  
  // Sort active trips by status priority
  displayedTrips.sort((a, b) => {
    const orderA = statusOrder[a.status] || 99;
    const orderB = statusOrder[b.status] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
  });
  
  // Calculate COUNTS based on allDashboardTrips (unfiltered)
  const arrivingCount = allDashboardTrips.filter(t => t.status === 'Arriving').length;
  const arrivingPax = allDashboardTrips.filter(t => t.status === 'Arriving').reduce((sum, t) => sum + (t.passengers_boarded || 0), 0);

  const activeCount = allDashboardTrips.filter(t => t.status === "Active").length;
  const activePax = allDashboardTrips.filter(t => t.status === "Active").reduce((sum, t) => sum + (t.passengers_boarded || 0), 0);
  
  const breakdowns = allDashboardTrips.filter(t => t.status === 'Breakdown').length;
  const breakdownPax = allDashboardTrips.filter(t => t.status === 'Breakdown').reduce((sum, t) => sum + (t.passengers_boarded || 0), 0);
  
  const plannedCount = allDashboardTrips.filter(t => t.status === 'Scheduled' || t.status === 'Planned').length;
  const plannedPax = allDashboardTrips.filter(t => t.status === 'Scheduled' || t.status === 'Planned').reduce((sum, t) => sum + (t.passengers_boarded || 0), 0);
  
  const completedCount = allDashboardTrips.filter(t => t.status === 'Completed').length;
  const completedPax = allDashboardTrips.filter(t => t.status === 'Completed').reduce((sum, t) => sum + (t.passengers_boarded || 0), 0);

  const cancelledCount = allHistoryTrips.filter(t => t.status === 'Cancelled').length;
  const cancelledPax = allHistoryTrips.filter(t => t.status === 'Cancelled').reduce((sum, t) => sum + (t.passengers_boarded || 0), 0);

  // Total count currently visible in history window
  const totalInHistory = allHistoryTrips.length;
  const totalPax = allHistoryTrips.reduce((sum, t) => sum + (t.passengers_boarded || 0), 0);

  // Helper to generate toggle URL
  const getToggleUrl = (targetStatus: string) => {
    const newStatuses = new Set(selectedStatuses);
    if (newStatuses.has(targetStatus)) {
      newStatuses.delete(targetStatus);
    } else {
      newStatuses.add(targetStatus);
    }
    const params = new URLSearchParams();
    if (historyDays !== 7) params.set('historyDays', historyDays.toString());
    if (newStatuses.size > 0) params.set('status', Array.from(newStatuses).join(','));
    // If no statuses, we show ALL (displayedTrips = allDashboardTrips)
    // Actually if no status, displayedTrips = allDashboardTrips.
    return `/dashboard?${params.toString()}`;
  };

  const isSelected = (s: string) => selectedStatuses.includes(s);

  return (
    <>

      <header className="dashboard-header">
        <div className="dashboard-header-titles">
          <h1>Command Center</h1>
          <p className="subtitle">War Room - Active Trip Monitoring</p>
          <div style={{ marginTop: '8px' }}>
            <DashboardHistoryFilter historyDays={historyDays} />
          </div>
        </div>

        <RefreshControl showAutoRefresh={true} />
      </header>

      {/* 1. Summary Cards Layer */}
      <section className="summary-grid">
        <Link href={getToggleUrl('Breakdown')} className={`stat-card ${isSelected('Breakdown') ? 'ring-2 ring-primary ring-offset-2' : ''}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative' }}>
          {isSelected('Breakdown') && <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.2rem' }}>✅</div>}
          <div className="stat-title">Breakdowns</div>
          <div className="stat-value breakdown">{breakdowns}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span>👥</span> {breakdownPax} pax</div>
        </Link>
        <Link href={getToggleUrl('Arriving')} className={`stat-card ${isSelected('Arriving') ? 'ring-2 ring-primary ring-offset-2' : ''}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative' }}>
          {isSelected('Arriving') && <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.2rem' }}>✅</div>}
          <div className="stat-title">Arriving</div>
          <div className="stat-value arriving">{arrivingCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span>👥</span> {arrivingPax} pax</div>
        </Link>
        <Link href={getToggleUrl('Active')} className={`stat-card ${isSelected('Active') ? 'ring-2 ring-primary ring-offset-2' : ''}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative' }}>
          {isSelected('Active') && <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.2rem' }}>✅</div>}
          <div className="stat-title">Active</div>
          <div className="stat-value active">{activeCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span>👥</span> {activePax} pax</div>
        </Link>
        <Link href={getToggleUrl('Scheduled')} className={`stat-card ${isSelected('Scheduled') ? 'ring-2 ring-primary ring-offset-2' : ''}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative' }}>
          {isSelected('Scheduled') && <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.2rem' }}>✅</div>}
          <div className="stat-title">Scheduled</div>
          <div className="stat-value approaching">{plannedCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span>👥</span> {plannedPax} pax</div>
        </Link>
        <Link href={getToggleUrl('Completed')} className={`stat-card ${isSelected('Completed') ? 'ring-2 ring-primary ring-offset-2' : ''}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative' }}>
          {isSelected('Completed') && <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.2rem' }}>✅</div>}
          <div className="stat-title">Completed</div>
          <div className="stat-value parked">{completedCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span>👥</span> {completedPax} pax</div>
        </Link>
        <Link href={getToggleUrl('Cancelled')} className={`stat-card ${isSelected('Cancelled') ? 'ring-2 ring-primary ring-offset-2' : ''}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative' }}>
          {isSelected('Cancelled') && <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.2rem' }}>✅</div>}
          <div className="stat-title">Cancelled</div>
          <div className="stat-value cancelled">{cancelledCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span>👥</span> {cancelledPax} pax</div>
        </Link>
        <Link href={`/dashboard?${new URLSearchParams({ historyDays: historyDays.toString() }).toString()}`} className="stat-card" style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
          <div className="stat-title">Total Trips</div>
          <div className="stat-value total">{totalInHistory}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><span>👥</span> {totalPax} pax</div>
        </Link>
      </section>

      {/* 4. Active Trips List Layer */}
      <DashboardClient
        hierarchy={hierarchy} 
        allTrips={allHistoryTrips}
        dashboardTrips={displayedTrips}
        vehicles={vehicles}
        volunteers={volunteers}
        subStatuses={subStatuses}
        locations={locations} statuses={statuses}
      />
    </>
  );
}
