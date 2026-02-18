export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getSession();

  if (session) {
    if (session.role === 'SUPER_ADMIN' || session.role === 'COMMAND_CENTER') {
      redirect('/dashboard');
    }
    if (session.role === 'REGION_ADMIN' || session.role === 'TRIP_ADMIN') {
      redirect('/manage-trips');
    }
    // Default for others (VOLUNTEER, etc.)
    redirect('/my-location-trips');
  }

  // If no session, redirect to login
  redirect('/login');
}
