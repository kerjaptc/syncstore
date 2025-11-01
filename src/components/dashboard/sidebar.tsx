'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Store,
  Package,
  Warehouse,
  ShoppingCart,
  BarChart3,
  Settings,
  Users,
  RefreshCw,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { OrganizationSelector } from './organization-selector';

interface User {
  id: string;
  email: string;
  fullName?: string;
  organizationId: string;
  role: string;
}

interface SidebarProps {
  user: User;
}

const navigationItems = [
  {
    title: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Dashboard overview and metrics',
  },
  {
    title: 'Stores',
    href: '/dashboard/stores',
    icon: Store,
    description: 'Manage connected stores',
    badge: 'New',
  },
  {
    title: 'Products',
    href: '/dashboard/products',
    icon: Package,
    description: 'Product catalog management',
  },
  {
    title: 'Inventory',
    href: '/dashboard/inventory',
    icon: Warehouse,
    description: 'Stock levels and adjustments',
  },
  {
    title: 'Orders',
    href: '/dashboard/orders',
    icon: ShoppingCart,
    description: 'Order management and fulfillment',
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    description: 'Sales and performance analytics',
  },
  {
    title: 'Sync',
    href: '/dashboard/sync',
    icon: RefreshCw,
    description: 'Synchronization status and logs',
  },
];

const settingsItems = [
  {
    title: 'Team',
    href: '/dashboard/team',
    icon: Users,
    description: 'Manage team members and roles',
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'System and organization settings',
  },
];

export function DashboardSidebar({ user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo and Organization Selector */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 bg-clip-text text-transparent">
              StoreSync
            </span>
          )}
        </div>
        
        {!isCollapsed && <OrganizationSelector user={user} />}
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-2 py-4">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-2 h-10',
                      isCollapsed && 'px-2',
                      isActive && 'bg-secondary'
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>

          <Separator className="my-4" />

          {/* Settings Navigation */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Settings
              </p>
            )}
            {settingsItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-2 h-10',
                      isCollapsed && 'px-2',
                      isActive && 'bg-secondary'
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && (
                      <span className="flex-1 text-left">{item.title}</span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Collapse Toggle */}
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full justify-center"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          'hidden md:flex flex-col border-r bg-card transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden fixed top-4 left-4 z-50"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}