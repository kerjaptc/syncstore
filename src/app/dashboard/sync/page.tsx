import { requireAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play } from 'lucide-react';

// Force dynamic rendering to avoid build-time Clerk issues
export const dynamic = 'force-dynamic';

export default async function SyncPage() {
  const user = await requireAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Synchronization</h1>
          <p className="text-muted-foreground">
            Monitor and manage data synchronization
          </p>
        </div>
        <Button disabled>
          <Play className="h-4 w-4 mr-2" />
          Sync Now
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync Management
          </CardTitle>
          <CardDescription>
            This page will be implemented in Task 6
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sync status monitoring, job scheduling, error logs, and manual sync triggers will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}