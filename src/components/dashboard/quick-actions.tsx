'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Package,
  Upload,
  Download,
  RefreshCw,
  Plus,
  Settings,
  BarChart3,
  FileText,
  Users,
  Zap,
} from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  variant: 'default' | 'secondary' | 'outline';
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'connect-store',
    title: 'Connect Store',
    description: 'Add a new marketplace store',
    icon: Store,
    href: '/dashboard/stores/connect',
    variant: 'default',
    badge: 'Popular',
    disabled: true,
    disabledReason: 'Available after Task 5 implementation',
  },
  {
    id: 'add-product',
    title: 'Add Product',
    description: 'Create a new product in catalog',
    icon: Package,
    href: '/dashboard/products/new',
    variant: 'secondary',
    disabled: true,
    disabledReason: 'Available after Task 4 implementation',
  },
  {
    id: 'sync-all',
    title: 'Sync All Stores',
    description: 'Trigger manual synchronization',
    icon: RefreshCw,
    href: '/dashboard/sync',
    variant: 'outline',
    disabled: true,
    disabledReason: 'Available after Task 6 implementation',
  },
  {
    id: 'import-products',
    title: 'Import Products',
    description: 'Bulk import from CSV/Excel',
    icon: Upload,
    href: '/dashboard/products/import',
    variant: 'outline',
    disabled: true,
    disabledReason: 'Available after Task 7.3 implementation',
  },
  {
    id: 'export-orders',
    title: 'Export Orders',
    description: 'Download order reports',
    icon: Download,
    href: '/dashboard/orders/export',
    variant: 'outline',
    disabled: true,
    disabledReason: 'Available after Task 7.5 implementation',
  },
  {
    id: 'view-analytics',
    title: 'View Analytics',
    description: 'Sales and performance insights',
    icon: BarChart3,
    href: '/dashboard/analytics',
    variant: 'outline',
    disabled: true,
    disabledReason: 'Available after Task 8 implementation',
  },
];

const managementActions: QuickAction[] = [
  {
    id: 'manage-team',
    title: 'Manage Team',
    description: 'Invite and manage team members',
    icon: Users,
    href: '/dashboard/team',
    variant: 'outline',
    disabled: true,
    disabledReason: 'Available after core implementation',
  },
  {
    id: 'system-settings',
    title: 'System Settings',
    description: 'Configure organization settings',
    icon: Settings,
    href: '/dashboard/settings',
    variant: 'outline',
    disabled: true,
    disabledReason: 'Available after core implementation',
  },
  {
    id: 'automation',
    title: 'Automation Rules',
    description: 'Set up automated workflows',
    icon: Zap,
    href: '/dashboard/automation',
    variant: 'outline',
    badge: 'Pro',
    disabled: true,
    disabledReason: 'Available in future releases',
  },
];

export function QuickActions() {
  const ActionCard = ({ action }: { action: QuickAction }) => {
    const content = (
      <Card className={`transition-all hover:shadow-md ${action.disabled ? 'opacity-60' : 'hover:scale-105'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <action.icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">{action.title}</CardTitle>
            </div>
            {action.badge && (
              <Badge variant="secondary" className="text-xs">
                {action.badge}
              </Badge>
            )}
          </div>
          <CardDescription className="text-sm">
            {action.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            variant={action.variant}
            size="sm"
            className="w-full"
            disabled={action.disabled}
          >
            <Plus className="h-3 w-3 mr-2" />
            {action.disabled ? 'Coming Soon' : 'Get Started'}
          </Button>
          {action.disabled && action.disabledReason && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {action.disabledReason}
            </p>
          )}
        </CardContent>
      </Card>
    );

    if (action.disabled) {
      return content;
    }

    return (
      <Link href={action.href}>
        {content}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {/* Primary Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      </div>

      {/* Management Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {managementActions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      </div>

      {/* Getting Started Guide */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Getting Started
          </CardTitle>
          <CardDescription>
            Follow these steps to set up your StoreSync system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400">
                ✓
              </div>
              <span className="text-muted-foreground line-through">
                Complete project setup and authentication
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400">
                2
              </div>
              <span>Set up database schema and core models</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                3
              </div>
              <span className="text-muted-foreground">
                Implement core services and platform integrations
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                4
              </div>
              <span className="text-muted-foreground">
                Connect your first marketplace store
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-4" disabled>
            View Full Setup Guide
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}