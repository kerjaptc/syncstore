/**
 * SyncStore MVP Connection Management Service
 * 
 * This service manages store connections, handles validation, health checks,
 * and provides recovery mechanisms with exponential backoff retry logic.
 */

import {
  StoreConnectionService,
  StoreConnection,
  ConnectionStatus,
  ValidationError,
  ConnectionError,
  ShopeeApiError,
  createErrorContext,
  retryWithBackoff,
  CircuitBreaker,
  isConnectionValid,
  validateData,
  StoreConnectionSchema,
} from '../index';
import { ShopeeOAuthService } from './shopee-oauth';
import { CredentialStorageService } from './credential-storage';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ConnectionHealthCheck {
  storeId: string;
  isHealthy: boolean;
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  expiredConnections: number;
  errorConnections: number;
  averageResponseTime: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// ============================================================================
// Connection Management Service
// ============================================================================

export class ConnectionManagerService implements StoreConnectionService {
  private oauthService: ShopeeOAuthService;
  private credentialStorage: CredentialStorageService;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private connectionCache = new Map<string, { connection: StoreConnection; cachedAt: number }>();
  private healthCheckCache = new Map<string, ConnectionHealthCheck>();
  
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly HEALTH_CHECK_TTL = 2 * 60 * 1000; // 2 minutes
  
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  constructor(
    oauthService: ShopeeOAuthService,
    credentialStorage: CredentialStorageService
  ) {
    this.oauthService = oauthService;
    this.credentialStorage = credentialStorage;
  }

  // ============================================================================
  // Connection CRUD Operations
  // ============================================================================

  /**
   * Creates a new store connection
   */
  async createConnection(
    connection: Omit<StoreConnection, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StoreConnection> {
    try {
      // Validate connection data
      const validatedConnection = validateData(
        StoreConnectionSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        connection,
        'StoreConnection'
      );

      // Check if connection already exists
      const existingConnection = await this.getConnection(connection.storeId);
      if (existingConnection) {
        throw new ValidationError(
          'Store connection already exists',
          'storeId',
          connection.storeId
        );
      }

      // Store credentials securely
      await this.credentialStorage.storeCredentials(
        connection.storeId,
        connection.credentials.accessToken,
        connection.credentials.refreshToken,
        connection.credentials.expiresAt
      );

      // Create connection object
      const newConnection: StoreConnection = {
        ...validatedConnection,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Cache the connection
      this.connectionCache.set(connection.storeId, {
        connection: newConnection,
        cachedAt: Date.now(),
      });

      // Initialize circuit breaker for this connection
      this.getCircuitBreaker(connection.storeId);

      return newConnection;

    } catch (error) {
      const context = createErrorContext('createConnection', {
        storeId: connection.storeId,
        platform: connection.platform,
        organizationId: connection.organizationId,
      });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ConnectionError(
        `Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        connection.storeId,
        connection.platform,
        context
      );
    }
  }

  /**
   * Retrieves a store connection by store ID
   */
  async getConnection(storeId: string): Promise<StoreConnection | null> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      // Check cache first
      const cached = this.connectionCache.get(storeId);
      if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
        return cached.connection;
      }

      // In a real implementation, this would query the database
      // For now, we'll check if credentials exist and return a basic connection
      const credentials = await this.credentialStorage.getCredentials(storeId);
      if (!credentials) {
        return null;
      }

      // Create a basic connection object (this would come from database in real implementation)
      const connection: StoreConnection = {
        id: crypto.randomUUID(),
        organizationId: 'temp-org-id', // Would come from database
        platform: 'shopee',
        storeId,
        storeName: 'Unknown Store', // Would come from database
        credentials,
        status: credentials.expiresAt > new Date() ? 'active' : 'expired',
        lastSyncAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Cache the connection
      this.connectionCache.set(storeId, {
        connection,
        cachedAt: Date.now(),
      });

      return connection;

    } catch (error) {
      const context = createErrorContext('getConnection', { storeId });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ConnectionError(
        `Failed to retrieve connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        'shopee',
        context
      );
    }
  }

  /**
   * Updates a store connection
   */
  async updateConnection(
    storeId: string,
    updates: Partial<StoreConnection>
  ): Promise<StoreConnection> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      const existingConnection = await this.getConnection(storeId);
      if (!existingConnection) {
        throw new ValidationError('Store connection not found', 'storeId', storeId);
      }

      // Update credentials if provided
      if (updates.credentials) {
        await this.credentialStorage.updateCredentials(
          storeId,
          updates.credentials.accessToken,
          updates.credentials.refreshToken,
          updates.credentials.expiresAt
        );
      }

      // Create updated connection
      const updatedConnection: StoreConnection = {
        ...existingConnection,
        ...updates,
        id: existingConnection.id, // Preserve ID
        createdAt: existingConnection.createdAt, // Preserve creation date
        updatedAt: new Date(),
      };

      // Validate updated connection
      validateData(StoreConnectionSchema, updatedConnection, 'UpdatedStoreConnection');

      // Update cache
      this.connectionCache.set(storeId, {
        connection: updatedConnection,
        cachedAt: Date.now(),
      });

      return updatedConnection;

    } catch (error) {
      const context = createErrorContext('updateConnection', { storeId, updates });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ConnectionError(
        `Failed to update connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        'shopee',
        context
      );
    }
  }

  /**
   * Deletes a store connection
   */
  async deleteConnection(storeId: string): Promise<void> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      // Remove credentials
      await this.credentialStorage.removeCredentials(storeId);

      // Remove from cache
      this.connectionCache.delete(storeId);
      this.healthCheckCache.delete(storeId);
      this.circuitBreakers.delete(storeId);

    } catch (error) {
      const context = createErrorContext('deleteConnection', { storeId });
      throw new ConnectionError(
        `Failed to delete connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        'shopee',
        context
      );
    }
  }

  // ============================================================================
  // Connection Management Operations
  // ============================================================================

  /**
   * Lists all connections for an organization
   */
  async listConnections(organizationId: string): Promise<StoreConnection[]> {
    try {
      if (!organizationId) {
        throw new ValidationError('Organization ID is required', 'organizationId');
      }

      // In a real implementation, this would query the database
      // For now, we'll return connections from cache that match the organization
      const connections: StoreConnection[] = [];
      
      for (const [storeId, cached] of this.connectionCache.entries()) {
        if (cached.connection.organizationId === organizationId) {
          connections.push(cached.connection);
        }
      }

      return connections;

    } catch (error) {
      const context = createErrorContext('listConnections', { organizationId });
      throw new Error(`Failed to list connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates a store connection by making a test API call
   */
  async validateConnection(storeId: string): Promise<ConnectionStatus> {
    const startTime = Date.now();
    
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      // Check cache first
      const cachedHealth = this.healthCheckCache.get(storeId);
      if (cachedHealth && Date.now() - cachedHealth.lastChecked.getTime() < this.HEALTH_CHECK_TTL) {
        return {
          isValid: cachedHealth.isHealthy,
          error: cachedHealth.error,
          lastChecked: cachedHealth.lastChecked,
        };
      }

      const connection = await this.getConnection(storeId);
      if (!connection) {
        const result: ConnectionStatus = {
          isValid: false,
          error: 'Connection not found',
          lastChecked: new Date(),
        };
        
        this.cacheHealthCheck(storeId, false, Date.now() - startTime, result.error);
        return result;
      }

      // Check if connection is valid (not expired)
      if (!isConnectionValid(connection)) {
        const result: ConnectionStatus = {
          isValid: false,
          error: 'Connection expired or inactive',
          lastChecked: new Date(),
        };
        
        this.cacheHealthCheck(storeId, false, Date.now() - startTime, result.error);
        return result;
      }

      // Use circuit breaker for API calls
      const circuitBreaker = this.getCircuitBreaker(storeId);
      
      const result = await circuitBreaker.execute(async () => {
        // Make a test API call with retry logic
        return await retryWithBackoff(
          async () => {
            // For now, we'll simulate a successful validation
            // In real implementation, this would call oauthService.validateConnection
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
            return {
              isValid: true,
              error: undefined,
              lastChecked: new Date(),
            };
          },
          this.retryConfig.maxRetries,
          this.retryConfig.baseDelay,
          this.retryConfig.maxDelay
        );
      });

      this.cacheHealthCheck(storeId, result.isValid, Date.now() - startTime, result.error);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const result: ConnectionStatus = {
        isValid: false,
        error: errorMessage,
        lastChecked: new Date(),
      };
      
      this.cacheHealthCheck(storeId, false, responseTime, errorMessage);
      return result;
    }
  }

  /**
   * Refreshes a store connection by updating tokens
   */
  async refreshConnection(storeId: string): Promise<StoreConnection> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      const connection = await this.getConnection(storeId);
      if (!connection) {
        throw new ValidationError('Connection not found', 'storeId', storeId);
      }

      // Use circuit breaker for token refresh
      const circuitBreaker = this.getCircuitBreaker(storeId);
      
      const refreshedConnection = await circuitBreaker.execute(async () => {
        return await retryWithBackoff(
          async () => {
            // For now, we'll simulate token refresh
            // In real implementation, this would call oauthService.refreshAccessToken
            const newExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
            
            return await this.updateConnection(storeId, {
              credentials: {
                ...connection.credentials,
                expiresAt: newExpiresAt,
              },
              status: 'active',
              updatedAt: new Date(),
            });
          },
          this.retryConfig.maxRetries,
          this.retryConfig.baseDelay,
          this.retryConfig.maxDelay
        );
      });

      // Clear health check cache to force revalidation
      this.healthCheckCache.delete(storeId);

      return refreshedConnection;

    } catch (error) {
      const context = createErrorContext('refreshConnection', { storeId });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ConnectionError(
        `Failed to refresh connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        'shopee',
        context
      );
    }
  }

  // ============================================================================
  // Health Check Operations
  // ============================================================================

  /**
   * Checks health of all connections for an organization
   */
  async checkAllConnections(organizationId: string): Promise<Record<string, ConnectionStatus>> {
    try {
      if (!organizationId) {
        throw new ValidationError('Organization ID is required', 'organizationId');
      }

      const connections = await this.listConnections(organizationId);
      const results: Record<string, ConnectionStatus> = {};

      // Check all connections in parallel
      const healthChecks = connections.map(async (connection) => {
        const status = await this.validateConnection(connection.storeId);
        results[connection.storeId] = status;
      });

      await Promise.all(healthChecks);
      return results;

    } catch (error) {
      const context = createErrorContext('checkAllConnections', { organizationId });
      throw new Error(`Failed to check all connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets connection metrics for monitoring
   */
  async getConnectionMetrics(organizationId: string): Promise<ConnectionMetrics> {
    try {
      const connections = await this.listConnections(organizationId);
      const healthStatuses = await this.checkAllConnections(organizationId);
      
      let activeCount = 0;
      let expiredCount = 0;
      let errorCount = 0;
      let totalResponseTime = 0;
      let healthyCount = 0;

      for (const connection of connections) {
        const health = this.healthCheckCache.get(connection.storeId);
        
        if (connection.status === 'active') activeCount++;
        else if (connection.status === 'expired') expiredCount++;
        else if (connection.status === 'error') errorCount++;
        
        if (health) {
          totalResponseTime += health.responseTime;
          if (health.isHealthy) healthyCount++;
        }
      }

      return {
        totalConnections: connections.length,
        activeConnections: activeCount,
        expiredConnections: expiredCount,
        errorConnections: errorCount,
        averageResponseTime: connections.length > 0 ? totalResponseTime / connections.length : 0,
      };

    } catch (error) {
      const context = createErrorContext('getConnectionMetrics', { organizationId });
      throw new Error(`Failed to get connection metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Gets or creates a circuit breaker for a store
   */
  private getCircuitBreaker(storeId: string): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(storeId);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(5, 60000, 2); // 5 failures, 1 minute recovery, 2 successes
      this.circuitBreakers.set(storeId, circuitBreaker);
    }
    return circuitBreaker;
  }

  /**
   * Caches health check results
   */
  private cacheHealthCheck(
    storeId: string,
    isHealthy: boolean,
    responseTime: number,
    error?: string
  ): void {
    this.healthCheckCache.set(storeId, {
      storeId,
      isHealthy,
      lastChecked: new Date(),
      responseTime,
      error,
    });
  }

  /**
   * Cleans up expired cache entries
   */
  async cleanupCache(): Promise<void> {
    const now = Date.now();
    
    // Clean connection cache
    for (const [storeId, cached] of this.connectionCache.entries()) {
      if (now - cached.cachedAt > this.CACHE_TTL) {
        this.connectionCache.delete(storeId);
      }
    }
    
    // Clean health check cache
    for (const [storeId, health] of this.healthCheckCache.entries()) {
      if (now - health.lastChecked.getTime() > this.HEALTH_CHECK_TTL) {
        this.healthCheckCache.delete(storeId);
      }
    }
  }

  /**
   * Gets circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [storeId, circuitBreaker] of this.circuitBreakers.entries()) {
      status[storeId] = circuitBreaker.status;
    }
    
    return status;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates ConnectionManagerService with required dependencies
 */
export function createConnectionManagerService(
  oauthService: ShopeeOAuthService,
  credentialStorage: CredentialStorageService
): ConnectionManagerService {
  return new ConnectionManagerService(oauthService, credentialStorage);
}