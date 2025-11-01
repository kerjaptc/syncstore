import { requireAuth } from '@/lib/auth';
import { DashboardOverview } from '@/components/dashboard/overview';

// Force dynamic rendering to avoid build-time Clerk issues
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireAuth();

  return <DashboardOverview user={user} />;
}