/**
 * Authentication utilities and helpers
 * Integrates Clerk authentication with our database models
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, organizations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { UserWithOrganization, UserRole } from '@/types';

/**
 * Get the current authenticated user with organization data
 * Returns null if user is not authenticated
 */
export async function getCurrentUser(): Promise<UserWithOrganization | null> {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    // Get user from our database with organization
    const dbUser = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          settings: organizations.settings,
          subscriptionPlan: organizations.subscriptionPlan,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
        },
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, clerkUser.id))
      .limit(1);

    if (dbUser.length === 0) {
      // User exists in Clerk but not in our database
      // This might happen during the onboarding process
      return null;
    }

    return dbUser[0] as UserWithOrganization;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Require authentication and return the current user
 * Redirects to sign-in if user is not authenticated
 */
export async function requireAuth(): Promise<UserWithOrganization> {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  return user;
}

/**
 * Check if user has required role
 */
export function hasRole(user: UserWithOrganization, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4,
  };

  const userRoleLevel = roleHierarchy[user.role as UserRole] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Require specific role and return the current user
 * Throws error if user doesn't have required role
 */
export async function requireRole(requiredRole: UserRole): Promise<UserWithOrganization> {
  const user = await requireAuth();
  
  if (!hasRole(user, requiredRole)) {
    throw new Error(`Access denied. Required role: ${requiredRole}, user role: ${user.role}`);
  }

  return user;
}

/**
 * Check if user can access organization
 */
export async function canAccessOrganization(organizationId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  
  return user.organizationId === organizationId;
}

/**
 * Require organization access
 */
export async function requireOrganizationAccess(organizationId: string): Promise<UserWithOrganization> {
  const user = await requireAuth();
  
  if (user.organizationId !== organizationId) {
    throw new Error('Access denied. User does not belong to this organization.');
  }

  return user;
}

/**
 * Update user's last active timestamp
 */
export async function updateLastActive(userId: string): Promise<void> {
  try {
    await db
      .update(users)
      .set({ 
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('Error updating last active:', error);
    // Don't throw error as this is not critical
  }
}

/**
 * Get user permissions based on role
 */
export function getUserPermissions(role: string): {
  canManageUsers: boolean;
  canManageStores: boolean;
  canManageProducts: boolean;
  canManageOrders: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
} {
  const permissions = {
    canManageUsers: false,
    canManageStores: false,
    canManageProducts: false,
    canManageOrders: false,
    canViewAnalytics: false,
    canManageSettings: false,
    canManageBilling: false,
  };

  switch (role) {
    case 'owner':
      return {
        canManageUsers: true,
        canManageStores: true,
        canManageProducts: true,
        canManageOrders: true,
        canViewAnalytics: true,
        canManageSettings: true,
        canManageBilling: true,
      };
    
    case 'admin':
      return {
        canManageUsers: true,
        canManageStores: true,
        canManageProducts: true,
        canManageOrders: true,
        canViewAnalytics: true,
        canManageSettings: true,
        canManageBilling: false,
      };
    
    case 'member':
      return {
        canManageUsers: false,
        canManageStores: false,
        canManageProducts: true,
        canManageOrders: true,
        canViewAnalytics: true,
        canManageSettings: false,
        canManageBilling: false,
      };
    
    case 'viewer':
      return {
        canManageUsers: false,
        canManageStores: false,
        canManageProducts: false,
        canManageOrders: false,
        canViewAnalytics: true,
        canManageSettings: false,
        canManageBilling: false,
      };
    
    default:
      return permissions;
  }
}

/**
 * Check if user can perform specific action
 */
export function canPerformAction(
  user: UserWithOrganization,
  action: keyof ReturnType<typeof getUserPermissions>
): boolean {
  const permissions = getUserPermissions(user.role);
  return permissions[action];
}

/**
 * Require specific permission
 */
export async function requirePermission(
  action: keyof ReturnType<typeof getUserPermissions>
): Promise<UserWithOrganization> {
  const user = await requireAuth();
  
  if (!canPerformAction(user, action)) {
    throw new Error(`Access denied. Missing permission: ${action}`);
  }

  return user;
}