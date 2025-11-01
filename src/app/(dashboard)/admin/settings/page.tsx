import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsDashboard } from '@/components/admin/settings-dashboard';

export default async function AdminSettingsPage() {
  const user = await requireAuth();

  // Check if user has admin permissions
  if (!['owner', 'admin'].includes(user.role)) {
    redirect('/unauthorized');
  }

  return (
    <div className="container mx-auto py-6">
      <SettingsDashboard />
    </div>
  );
}

export const metadata = {
  title: 'API Configuration - StoreSync',
  description: 'Manage your marketplace integrations and external service configurations',
};