import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  organizationId: string;
  role: string;
}

/**
 * Require authentication and return user data
 * Redirects to sign-in if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect('/sign-in');
  }

  try {
    // Look up user in database using Clerk user ID
    const dbUser = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        organizationId: users.organizationId,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, clerkUser.id))
      .limit(1);

    if (dbUser.length === 0) {
      // User not found in database, create new user
      const email = clerkUser.emailAddresses[0]?.emailAddress || '';
      
      // For new users, we need to either:
      // 1. Create a default organization, or
      // 2. Redirect to organization setup
      // For now, we'll create a default organization
      
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: `${clerkUser.fullName || email.split('@')[0]}'s Organization`,
          slug: `org-${clerkUser.id.toLowerCase()}`,
          settings: {},
          subscriptionPlan: 'free',
        })
        .returning();

      const [newUser] = await db
        .insert(users)
        .values({
          id: clerkUser.id,
          organizationId: newOrg.id,
          email,
          fullName: clerkUser.fullName,
          role: 'owner', // First user in organization is owner
          isActive: true,
        })
        .returning();

      return {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName || undefined,
        organizationId: newUser.organizationId,
        role: newUser.role,
      };
    }

    const user = dbUser[0];

    // Check if user is active
    if (!user.isActive) {
      redirect('/account-suspended');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName || undefined,
      organizationId: user.organizationId,
      role: user.role,
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    // Fallback to basic user data if database is unavailable
    return {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      fullName: clerkUser.fullName || undefined,
      organizationId: 'temp-org', // Temporary fallback
      role: 'member', // Safe default role
    };
  }
}

/**
 * Get current user without redirecting
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  try {
    const dbUser = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        organizationId: users.organizationId,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, clerkUser.id))
      .limit(1);

    if (dbUser.length === 0) {
      return null;
    }

    const user = dbUser[0];

    if (!user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName || undefined,
      organizationId: user.organizationId,
      role: user.role,
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
}

/**
 * Check if user has required permission
 */
export async function requirePermission(permission: string): Promise<AuthUser> {
  const user = await requireAuth();
  
  // Define role hierarchy and permissions
  const rolePermissions: Record<string, string[]> = {
    owner: ['*'], // Owner has all permissions
    admin: [
      'manage_users',
      'manage_stores',
      'manage_products',
      'manage_orders',
      'manage_inventory',
      'view_analytics',
    ],
    member: [
      'manage_products',
      'manage_orders',
      'manage_inventory',
      'view_analytics',
    ],
    viewer: [
      'view_analytics',
    ],
  };

  const userPermissions = rolePermissions[user.role] || [];
  
  if (!userPermissions.includes('*') && !userPermissions.includes(permission)) {
    redirect('/unauthorized');
  }

  return user;
}