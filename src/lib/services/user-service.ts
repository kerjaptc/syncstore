/**
 * User Service
 * Handles user and organization management operations
 */

import { db } from '@/lib/db';
import { users, organizations, inventoryLocations } from '@/lib/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { generateSku } from '@/lib/db/utils';
import type { 
  InsertUser, 
  InsertOrganization, 
  SelectUser, 
  SelectOrganization,
  UserWithOrganization,
  OrganizationWithUsers,
  UserRole 
} from '@/lib/types-patch';

export class UserService {
  /**
   * Create a new organization with the first user as owner
   */
  async createOrganization(data: {
    name: string;
    userId: string;
    userEmail: string;
    userFullName?: string;
  }): Promise<{ organization: SelectOrganization; user: SelectUser }> {
    return await db.transaction(async (tx) => {
      // Generate unique slug from organization name
      const baseSlug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      let slug = baseSlug;
      let counter = 1;
      
      // Ensure slug is unique
      while (true) {
        const existing = await tx
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, slug))
          .limit(1);
        
        if (existing.length === 0) break;
        
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create organization
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: data.name,
          slug,
          settings: {
            timezone: 'Asia/Jakarta',
            currency: 'IDR',
            language: 'en',
            features: {
              multiLocation: true,
              analytics: true,
              automation: true,
            },
          },
          subscriptionPlan: 'free',
        })
        .returning();

      // Create user as organization owner
      const [user] = await tx
        .insert(users)
        .values({
          id: data.userId,
          organizationId: organization.id,
          email: data.userEmail,
          fullName: data.userFullName,
          role: 'owner',
          isActive: true,
        })
        .returning();

      // Create default inventory location
      await tx
        .insert(inventoryLocations)
        .values({
          organizationId: organization.id,
          name: 'Main Warehouse',
          address: {
            street: '',
            city: '',
            state: '',
            country: 'Indonesia',
            postalCode: '',
          },
          isDefault: true,
          isActive: true,
        });

      return { organization, user };
    });
  }

  /**
   * Get organization with user count and stats
   */
  async getOrganizationWithStats(organizationId: string): Promise<OrganizationWithUsers | null> {
    const result = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        settings: organizations.settings,
        subscriptionPlan: organizations.subscriptionPlan,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (result.length === 0) return null;

    const organization = result[0];

    // Get organization users
    const organizationUsers = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .orderBy(desc(users.createdAt));

    // Get counts (simplified for now - would be more complex queries in real implementation)
    const userCount = organizationUsers.length;

    return {
      ...organization,
      settings: organization.settings as any, // Type assertion for JSONB
      users: organizationUsers,
      _count: {
        users: userCount,
        stores: 0, // TODO: Implement when stores are created
        products: 0, // TODO: Implement when products are created
        orders: 0, // TODO: Implement when orders are created
      },
    };
  }

  /**
   * Get user with organization data
   */
  async getUserWithOrganization(userId: string): Promise<UserWithOrganization | null> {
    const result = await db
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
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) return null;

    return result[0] as UserWithOrganization;
  }

  /**
   * Create a new user in an organization
   */
  async createUser(data: {
    id: string;
    organizationId: string;
    email: string;
    fullName?: string;
    role: UserRole;
  }): Promise<SelectUser> {
    const [user] = await db
      .insert(users)
      .values({
        id: data.id,
        organizationId: data.organizationId,
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        isActive: true,
      })
      .returning();

    return user;
  }

  /**
   * Update user information
   */
  async updateUser(
    userId: string,
    data: Partial<{
      fullName: string;
      role: UserRole;
      isActive: boolean;
    }>
  ): Promise<SelectUser | null> {
    const [user] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user || null;
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Get organization users with pagination
   */
  async getOrganizationUsers(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      role?: UserRole;
      isActive?: boolean;
    } = {}
  ): Promise<{
    users: SelectUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, role, isActive } = options;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(users.organizationId, organizationId)];
    
    if (role) {
      conditions.push(eq(users.role, role));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    // Get users
    const userResults = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(and(...conditions));

    return {
      users: userResults,
      total,
      page,
      limit,
    };
  }

  /**
   * Update organization settings
   */
  async updateOrganizationSettings(
    organizationId: string,
    settings: Record<string, any>
  ): Promise<SelectOrganization | null> {
    const [organization] = await db
      .update(organizations)
      .set({
        settings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    return organization || null;
  }

  /**
   * Update organization subscription plan
   */
  async updateSubscriptionPlan(
    organizationId: string,
    plan: string
  ): Promise<SelectOrganization | null> {
    const [organization] = await db
      .update(organizations)
      .set({
        subscriptionPlan: plan,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    return organization || null;
  }

  /**
   * Check if user exists in organization
   */
  async userExistsInOrganization(userId: string, organizationId: string): Promise<boolean> {
    const result = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.organizationId, organizationId),
        eq(users.isActive, true)
      ))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string): Promise<SelectOrganization | null> {
    const result = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Check if organization slug is available
   */
  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const conditions = [eq(organizations.slug, slug)];
    
    if (excludeId) {
      conditions.push(eq(organizations.id, excludeId));
    }

    const result = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(excludeId ? and(...conditions) : conditions[0])
      .limit(1);

    return result.length === 0;
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string): Promise<{
    lastActive: Date | null;
    totalSessions: number;
    averageSessionDuration: number;
  }> {
    const user = await db
      .select({
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return {
        lastActive: null,
        totalSessions: 0,
        averageSessionDuration: 0,
      };
    }

    // TODO: Implement proper session tracking
    // For now, return basic data
    return {
      lastActive: user[0].lastActiveAt,
      totalSessions: 1,
      averageSessionDuration: 0,
    };
  }
}