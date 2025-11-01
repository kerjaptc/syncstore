import { requireAuth } from '@/lib/auth';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

// Force dynamic rendering to avoid build-time Clerk issues
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const user = await requireAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Sales and performance insights across all your platforms
        </p>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}