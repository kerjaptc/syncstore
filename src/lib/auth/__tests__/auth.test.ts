/**
 * Authentication utilities tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasRole, getUserPermissions, canPerformAction } from '../index';
import { UserRole, type UserWithOrganization } from '@/types';

// Mock user data
const createMockUser = (role: UserRole): UserWithOrganization => ({
  id: 'user-1',
  organizationId: 'org-1',
  email: 'test@example.com',
  fullName: 'Test User',
  role,
  isActive: true,
  lastActiveAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: {
    id: 'org-1',
    name: 'Test Organization',
    slug: 'test-org',
    settings: {},
    subscriptionPlan: 'free',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

describe('Authentication Utilities', () => {
  describe('hasRole', () => {
    it('should return true for exact role match', () => {
      const user = createMockUser('admin' as UserRole);
      expect(hasRole(user, 'ADMIN'.toLowerCase() as UserRole)).toBe(true);
    });

    it('should return true for higher role', () => {
      const user = createMockUser('OWNER'.toLowerCase() as UserRole);
      expect(hasRole(user, 'ADMIN'.toLowerCase() as UserRole)).toBe(true);
      expect(hasRole(user, UserRole.MEMBER)).toBe(true);
      expect(hasRole(user, UserRole.VIEWER)).toBe(true);
    });

    it('should return false for lower role', () => {
      const user = createMockUser(UserRole.MEMBER);
      expect(hasRole(user, 'ADMIN'.toLowerCase() as UserRole)).toBe(false);
      expect(hasRole(user, 'OWNER'.toLowerCase() as UserRole)).toBe(false);
    });

    it('should handle viewer role correctly', () => {
      const user = createMockUser(UserRole.VIEWER);
      expect(hasRole(user, UserRole.VIEWER)).toBe(true);
      expect(hasRole(user, UserRole.MEMBER)).toBe(false);
      expect(hasRole(user, 'ADMIN'.toLowerCase() as UserRole)).toBe(false);
      expect(hasRole(user, 'OWNER'.toLowerCase() as UserRole)).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for owner', () => {
      const permissions = getUserPermissions('owner');
      expect(permissions.canManageUsers).toBe(true);
      expect(permissions.canManageStores).toBe(true);
      expect(permissions.canManageProducts).toBe(true);
      expect(permissions.canManageOrders).toBe(true);
      expect(permissions.canViewAnalytics).toBe(true);
      expect(permissions.canManageSettings).toBe(true);
      expect(permissions.canManageBilling).toBe(true);
    });

    it('should return admin permissions (no billing)', () => {
      const permissions = getUserPermissions('admin');
      expect(permissions.canManageUsers).toBe(true);
      expect(permissions.canManageStores).toBe(true);
      expect(permissions.canManageProducts).toBe(true);
      expect(permissions.canManageOrders).toBe(true);
      expect(permissions.canViewAnalytics).toBe(true);
      expect(permissions.canManageSettings).toBe(true);
      expect(permissions.canManageBilling).toBe(false);
    });

    it('should return member permissions', () => {
      const permissions = getUserPermissions('member');
      expect(permissions.canManageUsers).toBe(false);
      expect(permissions.canManageStores).toBe(false);
      expect(permissions.canManageProducts).toBe(true);
      expect(permissions.canManageOrders).toBe(true);
      expect(permissions.canViewAnalytics).toBe(true);
      expect(permissions.canManageSettings).toBe(false);
      expect(permissions.canManageBilling).toBe(false);
    });

    it('should return viewer permissions (read-only)', () => {
      const permissions = getUserPermissions('viewer');
      expect(permissions.canManageUsers).toBe(false);
      expect(permissions.canManageStores).toBe(false);
      expect(permissions.canManageProducts).toBe(false);
      expect(permissions.canManageOrders).toBe(false);
      expect(permissions.canViewAnalytics).toBe(true);
      expect(permissions.canManageSettings).toBe(false);
      expect(permissions.canManageBilling).toBe(false);
    });

    it('should return no permissions for unknown role', () => {
      const permissions = getUserPermissions('unknown');
      expect(permissions.canManageUsers).toBe(false);
      expect(permissions.canManageStores).toBe(false);
      expect(permissions.canManageProducts).toBe(false);
      expect(permissions.canManageOrders).toBe(false);
      expect(permissions.canViewAnalytics).toBe(false);
      expect(permissions.canManageSettings).toBe(false);
      expect(permissions.canManageBilling).toBe(false);
    });
  });

  describe('canPerformAction', () => {
    it('should allow owner to perform all actions', () => {
      const user = createMockUser('OWNER'.toLowerCase() as UserRole);
      expect(canPerformAction(user, 'canManageUsers')).toBe(true);
      expect(canPerformAction(user, 'canManageBilling')).toBe(true);
    });

    it('should prevent admin from managing billing', () => {
      const user = createMockUser('ADMIN'.toLowerCase() as UserRole);
      expect(canPerformAction(user, 'canManageUsers')).toBe(true);
      expect(canPerformAction(user, 'canManageBilling')).toBe(false);
    });

    it('should prevent member from managing users', () => {
      const user = createMockUser(UserRole.MEMBER);
      expect(canPerformAction(user, 'canManageProducts')).toBe(true);
      expect(canPerformAction(user, 'canManageUsers')).toBe(false);
    });

    it('should only allow viewer to view analytics', () => {
      const user = createMockUser(UserRole.VIEWER);
      expect(canPerformAction(user, 'canViewAnalytics')).toBe(true);
      expect(canPerformAction(user, 'canManageProducts')).toBe(false);
    });
  });
});