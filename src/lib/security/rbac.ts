/**
 * Role-Based Access Control (RBAC) Service
 * Implements comprehensive role-based access control with principle of least privilege
 */

import { NextRequest } from 'next/server';

export enum UserRole {
  VIEWER = 'viewer',
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export enum Permission {
  // Organization permissions
  ORG_READ = 'org:read',
  ORG_UPDATE = 'org:update',
  ORG_DELETE = 'org:delete',
  ORG_MANAGE_USERS = 'org:manage_users',
  ORG_MANAGE_BILLING = 'org:manage_billing',

  // Store permissions
  STORE_READ = 'store:read',
  STORE_CREATE = 'store:create',
  STORE_UPDATE = 'store:update',
  STORE_DELETE = 'store:delete',
  STORE_CONNECT = 'store:connect',
  STORE_SYNC = 'store:sync',

  // Product permissions
  PRODUCT_READ = 'product:read',
  PRODUCT_CREATE = 'product:create',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',
  PRODUCT_BULK_IMPORT = 'product:bulk_import',
  PRODUCT_BULK_EXPORT = 'product:bulk_export',

  // Inventory permissions
  INVENTORY_READ = 'inventory:read',
  INVENTORY_UPDATE = 'inventory:update',
  INVENTORY_ADJUST = 'inventory:adjust',
  INVENTORY_TRANSFER = 'inventory:transfer',

  // Order permissions
  ORDER_READ = 'order:read',
  ORDER_UPDATE = 'order:update',
  ORDER_FULFILL = 'order:fulfill',
  ORDER_CANCEL = 'order:cancel',
  ORDER_REFUND = 'order:refund',
  ORDER_EXPORT = 'order:export',

  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',
  ANALYTICS_ADVANCED = 'analytics:advanced',

  // System permissions
  SYSTEM_LOGS = 'system:logs',
  SYSTEM_MONITORING = 'system:monitoring',
  SYSTEM_BACKUP = 'system:backup',
  SYSTEM_ADMIN = 'system:admin',

  // Webhook permissions
  WEBHOOK_READ = 'webhook:read',
  WEBHOOK_MANAGE = 'webhook:manage',

  // API permissions
  API_READ = 'api:read',
  API_WRITE = 'api:write',
  API_ADMIN = 'api:admin',
}

export enum Resource {
  ORGANIZATION = 'organization',
  STORE = 'store',
  PRODUCT = 'product',
  INVENTORY = 'inventory',
  ORDER = 'order',
  ANALYTICS = 'analytics',
  WEBHOOK = 'webhook',
  SYSTEM = 'system',
  USER = 'user',
}

interface RolePermissions {
  [UserRole.VIEWER]: Permission[];
  [UserRole.MEMBER]: Permission[];
  [UserRole.ADMIN]: Permission[];
  [UserRole.OWNER]: Permission[];
}

interface AccessContext {
  userId: string;
  organizationId: string;
  role: UserRole;
  resourceId?: string;
  resourceType?: Resource;
}

export class RBACService {
  /**
   * Define permissions for each role
   */
  private static readonly rolePermissions: RolePermissions = {
    [UserRole.VIEWER]: [
      // Read-only access to most resources
      Permission.ORG_READ,
      Permission.STORE_READ,
      Permission.PRODUCT_READ,
      Permission.INVENTORY_READ,
      Permission.ORDER_READ,
      Permission.ANALYTICS_READ,
      Permission.WEBHOOK_READ,
      Permission.API_READ,
    ],

    [UserRole.MEMBER]: [
      // All viewer permissions plus basic operations
      ...this.rolePermissions?.[UserRole.VIEWER] || [],
      Permission.PRODUCT_CREATE,
      Permission.PRODUCT_UPDATE,
      Permission.INVENTORY_UPDATE,
      Permission.ORDER_UPDATE,
      Permission.ORDER_FULFILL,
      Permission.STORE_SYNC,
      Permission.API_WRITE,
    ],

    [UserRole.ADMIN]: [
      // All member permissions plus advanced operations
      ...this.rolePermissions?.[UserRole.MEMBER] || [],
      Permission.STORE_CREATE,
      Permission.STORE_UPDATE,
      Permission.STORE_CONNECT,
      Permission.PRODUCT_DELETE,
      Permission.PRODUCT_BULK_IMPORT,
      Permission.PRODUCT_BULK_EXPORT,
      Permission.INVENTORY_ADJUST,
      Permission.INVENTORY_TRANSFER,
      Permission.ORDER_CANCEL,
      Permission.ORDER_REFUND,
      Permission.ORDER_EXPORT,
      Permission.ANALYTICS_EXPORT,
      Permission.ANALYTICS_ADVANCED,
      Permission.WEBHOOK_MANAGE,
      Permission.SYSTEM_LOGS,
      Permission.SYSTEM_MONITORING,
    ],

    [UserRole.OWNER]: [
      // All admin permissions plus organization management
      ...this.rolePermissions?.[UserRole.ADMIN] || [],
      Permission.ORG_UPDATE,
      Permission.ORG_DELETE,
      Permission.ORG_MANAGE_USERS,
      Permission.ORG_MANAGE_BILLING,
      Permission.STORE_DELETE,
      Permission.SYSTEM_BACKUP,
      Permission.SYSTEM_ADMIN,
      Permission.API_ADMIN,
    ],
  };

  /**
   * Resource ownership rules
   */
  private static readonly resourceOwnership = {
    [Resource.ORGANIZATION]: (context: AccessContext, resourceId: string) => 
      context.organizationId === resourceId,
    
    [Resource.STORE]: (context: AccessContext, resourceId: string) => 
      true, // Store ownership is checked via organization membership
    
    [Resource.PRODUCT]: (context: AccessContext, resourceId: string) => 
      true, // Product ownership is checked via organization membership
    
    [Resource.ORDER]: (context: AccessContext, resourceId: string) => 
      true, // Order ownership is checked via organization membership
    
    [Resource.USER]: (context: AccessContext, resourceId: string) => 
      context.userId === resourceId || context.role === UserRole.OWNER,
  };

  /**
   * Check if a role has a specific permission
   */
  static hasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = this.rolePermissions[role] || [];
    return permissions.includes(permission);
  }

  /**
   * Check if user has permission for a specific resource
   */
  static hasResourcePermission(
    context: AccessContext,
    permission: Permission,
    resourceId?: string
  ): boolean {
    // Check basic role permission
    if (!this.hasPermission(context.role, permission)) {
      return false;
    }

    // Check resource ownership if applicable
    if (resourceId && context.resourceType) {
      const ownershipCheck = this.resourceOwnership[context.resourceType];
      if (ownershipCheck && !ownershipCheck(context, resourceId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: UserRole): Permission[] {
    return this.rolePermissions[role] || [];
  }

  /**
   * Check if role can access resource type
   */
  static canAccessResource(role: UserRole, resource: Resource): boolean {
    const permissions = this.getRolePermissions(role);
    
    // Check if user has any permission for this resource type
    return permissions.some(permission => 
      permission.startsWith(`${resource}:`)
    );
  }

  /**
   * Get minimum role required for permission
   */
  static getMinimumRoleForPermission(permission: Permission): UserRole | null {
    const roles = [UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER];
    
    for (const role of roles) {
      if (this.hasPermission(role, permission)) {
        return role;
      }
    }
    
    return null;
  }

  /**
   * Validate role hierarchy
   */
  static isRoleHigherOrEqual(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy = {
      [UserRole.VIEWER]: 0,
      [UserRole.MEMBER]: 1,
      [UserRole.ADMIN]: 2,
      [UserRole.OWNER]: 3,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Create access control middleware
   */
  static createMiddleware(options: {
    permission: Permission;
    resource?: Resource;
    getResourceId?: (request: NextRequest) => string | undefined;
    allowSelf?: boolean; // Allow access to own resources
  }) {
    return async (request: NextRequest) => {
      // Extract user context from headers (set by auth middleware)
      const userId = request.headers.get('x-user-id');
      const organizationId = request.headers.get('x-organization-id');
      const role = request.headers.get('x-user-role') as UserRole;

      if (!userId || !organizationId || !role) {
        return new Response(
          JSON.stringify({ 
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const context: AccessContext = {
        userId,
        organizationId,
        role,
        resourceType: options.resource,
      };

      // Get resource ID if specified
      let resourceId: string | undefined;
      if (options.getResourceId) {
        resourceId = options.getResourceId(request);
      }

      // Check self-access for user resources
      if (options.allowSelf && options.resource === Resource.USER && resourceId) {
        if (userId === resourceId) {
          return null; // Allow access to own resource
        }
      }

      // Check permission
      if (!this.hasResourcePermission(context, options.permission, resourceId)) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: options.permission,
            current: role,
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return null; // Allow request to continue
    };
  }

  /**
   * Create role-based middleware
   */
  static createRoleMiddleware(requiredRole: UserRole) {
    return async (request: NextRequest) => {
      const role = request.headers.get('x-user-role') as UserRole;

      if (!role) {
        return new Response(
          JSON.stringify({ 
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (!this.isRoleHigherOrEqual(role, requiredRole)) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient role',
            code: 'INSUFFICIENT_ROLE',
            required: requiredRole,
            current: role,
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return null; // Allow request to continue
    };
  }

  /**
   * Check organization membership
   */
  static async checkOrganizationMembership(
    userId: string,
    organizationId: string
  ): Promise<{ isMember: boolean; role?: UserRole }> {
    // This would typically query the database
    // For now, we'll assume the user is a member if they have the org ID in their context
    // In a real implementation, you'd query the users table
    
    // Placeholder implementation
    return { isMember: true, role: UserRole.MEMBER };
  }

  /**
   * Get user permissions for organization
   */
  static async getUserPermissions(
    userId: string,
    organizationId: string
  ): Promise<Permission[]> {
    const membership = await this.checkOrganizationMembership(userId, organizationId);
    
    if (!membership.isMember || !membership.role) {
      return [];
    }

    return this.getRolePermissions(membership.role);
  }

  /**
   * Audit permission check
   */
  static auditPermissionCheck(
    context: AccessContext,
    permission: Permission,
    resourceId?: string,
    granted: boolean = false
  ): void {
    const auditLog = {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      role: context.role,
      permission,
      resourceType: context.resourceType,
      resourceId,
      granted,
      ip: 'unknown', // Would be extracted from request
    };

    // Log to audit system
    console.log('RBAC Audit:', auditLog);
    
    // In production, this would be sent to a proper audit logging system
  }

  /**
   * Validate role assignment
   */
  static validateRoleAssignment(
    assignerRole: UserRole,
    targetRole: UserRole
  ): { valid: boolean; error?: string } {
    // Only owners can assign owner role
    if (targetRole === UserRole.OWNER && assignerRole !== UserRole.OWNER) {
      return { valid: false, error: 'Only owners can assign owner role' };
    }

    // Admins and owners can assign admin and below
    if (targetRole === UserRole.ADMIN && 
        !this.isRoleHigherOrEqual(assignerRole, UserRole.ADMIN)) {
      return { valid: false, error: 'Insufficient permissions to assign admin role' };
    }

    // Members and above can assign member and viewer roles
    if ((targetRole === UserRole.MEMBER || targetRole === UserRole.VIEWER) &&
        !this.isRoleHigherOrEqual(assignerRole, UserRole.MEMBER)) {
      return { valid: false, error: 'Insufficient permissions to assign this role' };
    }

    return { valid: true };
  }

  /**
   * Get available roles for user to assign
   */
  static getAssignableRoles(userRole: UserRole): UserRole[] {
    switch (userRole) {
      case UserRole.OWNER:
        return [UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER];
      case UserRole.ADMIN:
        return [UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN];
      case UserRole.MEMBER:
        return [UserRole.VIEWER, UserRole.MEMBER];
      default:
        return [];
    }
  }
}