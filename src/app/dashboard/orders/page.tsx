import { requireAuth } from '@/lib/auth';
import { OrderManagement } from '@/components/orders/order-management';

// Force dynamic rendering to avoid build-time Clerk issues
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await requireAuth();

  return <OrderManagement user={user} />;
}