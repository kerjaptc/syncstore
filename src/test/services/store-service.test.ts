/**
 * Unit tests for Store Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoreService } from '@/lib/services/store-service';
import { AppError } from '@/lib/error-handling/app-error';
import { createMockStore, createMockOrganization } from '../factories';
import type { Store, ConnectStoreInput, StoreSettings } from '@/lib/types';

// Mock dependencies
const mockDb = {
  store: {
    create: vi.fn(),
    findById: vi.fn(),
    findByOrganization: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const mockEncryption = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
};

const mockPlatformService = {
  getAdapter: vi.fn(),
  testConnection: vi.fn(),
  refreshCredentials: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/security/encryption', () => ({ encryption: mockEncryption }));
vi.mock('@/lib/platforms/platform-service', () => ({ platformService: mockPlatformService }));
vi.mock('@/lib/error-handling/logger', () => ({ logger: mockLogger }));

describe('StoreService', () => {
  let storeService: StoreService;
  let mockOrganization: any;

  beforeEach(() => {
    vi.clearAllMocks();
    storeService = new StoreService();
    mockOrganization = createMockOrganization();
  });

  describe('connectStore', () => {
    it('should connect a new store successfully', async () => {
      const connectData: ConnectStoreInput = {
        platform: 'shopee',
        name: 'My Shopee Store',
        credentials: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          shopId: 'shop-123',
        },
      };

      const encryptedCredentials = 'encrypted-credentials';
      const expectedStore = createMockStore({
        platform: connectData.platform,
        name: connectData.name,
        organizationId: mockOrganization.id,
      });

      mockEncryption.encrypt.mockReturnValue(encryptedCredentials);
      mockPlatformService.testConnection.mockResolvedValue({ success: true });
      mockDb.store.create.mockResolvedValue(expectedStore);

      const result = await storeService.connectStore(mockOrganization.id, connectData);

      expect(result).toEqual(expectedStore);
      expect(mockEncryption.encrypt).toHaveBeenCalledWith(connectData.credentials);
      expect(mockPlatformService.testConnection).toHaveBeenCalledWith(
        connectData.platform,
        connectData.credentials
      );
      expect(mockDb.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganization.id,
          platform: connectData.platform,
          name: connectData.name,
          credentials: encryptedCredentials,
        })
      );
    });

    it('should throw error for invalid platform credentials', async () => {
      const connectData: ConnectStoreInput = {
        platform: 'shopee',
        name: 'Invalid Store',
        credentials: {
          accessToken: 'invalid-token',
        },
      };

      mockPlatformService.testConnection.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      await expect(
        storeService.connectStore(mockOrganization.id, connectData)
      ).rejects.toThrow(AppError);

      expect(mockDb.store.create).not.toHaveBeenCalled();
    });

    it('should validate required credentials for each platform', async () => {
      const invalidShopeeData: ConnectStoreInput = {
        platform: 'shopee',
        name: 'Incomplete Shopee Store',
        credentials: {
          // Missing required fields
        },
      };

      await expect(
        storeService.connectStore(mockOrganization.id, invalidShopeeData)
      ).rejects.toThrow(AppError);
    });

    it('should handle platform connection timeout', async () => {
      const connectData: ConnectStoreInput = {
        platform: 'tiktokshop',
        name: 'Timeout Store',
        credentials: {
          accessToken: 'test-token',
          shopId: 'shop-123',
        },
      };

      mockPlatformService.testConnection.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        storeService.connectStore(mockOrganization.id, connectData)
      ).rejects.toThrow(AppError);
    });
  });

  describe('disconnectStore', () => {
    it('should disconnect existing store', async () => {
      const storeId = 'store-123';
      const existingStore = createMockStore({ id: storeId });

      mockDb.store.findById.mockResolvedValue(existingStore);
      mockDb.store.update.mockResolvedValue({ ...existingStore, isActive: false });

      await storeService.disconnectStore(storeId);

      expect(mockDb.store.update).toHaveBeenCalledWith(storeId, {
        isActive: false,
        disconnectedAt: expect.any(Date),
      });
    });

    it('should throw error for non-existent store', async () => {
      const storeId = 'non-existent';

      mockDb.store.findById.mockResolvedValue(null);

      await expect(
        storeService.disconnectStore(storeId)
      ).rejects.toThrow(AppError);
    });
  });

  describe('refreshCredentials', () => {
    it('should refresh store credentials successfully', async () => {
      const storeId = 'store-123';
      const existingStore = createMockStore({ id: storeId });
      const decryptedCredentials = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
      };
      const newCredentials = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
      };

      mockDb.store.findById.mockResolvedValue(existingStore);
      mockEncryption.decrypt.mockReturnValue(decryptedCredentials);
      mockPlatformService.refreshCredentials.mockResolvedValue(newCredentials);
      mockEncryption.encrypt.mockReturnValue('new-encrypted-credentials');
      mockDb.store.update.mockResolvedValue({
        ...existingStore,
        credentials: 'new-encrypted-credentials',
      });

      const result = await storeService.refreshCredentials(storeId);

      expect(mockPlatformService.refreshCredentials).toHaveBeenCalledWith(
        existingStore.platform,
        decryptedCredentials
      );
      expect(mockDb.store.update).toHaveBeenCalledWith(storeId, {
        credentials: 'new-encrypted-credentials',
        updatedAt: expect.any(Date),
      });
    });

    it('should handle refresh token expiration', async () => {
      const storeId = 'store-123';
      const existingStore = createMockStore({ id: storeId });

      mockDb.store.findById.mockResolvedValue(existingStore);
      mockEncryption.decrypt.mockReturnValue({ refreshToken: 'expired-token' });
      mockPlatformService.refreshCredentials.mockRejectedValue(
        new Error('Refresh token expired')
      );

      await expect(
        storeService.refreshCredentials(storeId)
      ).rejects.toThrow(AppError);
    });
  });

  describe('checkStoreHealth', () => {
    it('should return healthy status for active store', async () => {
      const storeId = 'store-123';
      const existingStore = createMockStore({ id: storeId, isActive: true });

      mockDb.store.findById.mockResolvedValue(existingStore);
      mockEncryption.decrypt.mockReturnValue({ accessToken: 'valid-token' });
      mockPlatformService.testConnection.mockResolvedValue({ success: true });

      const result = await storeService.checkStoreHealth(storeId);

      expect(result.status).toBe('healthy');
      expect(result.lastChecked).toBeInstanceOf(Date);
      expect(result.issues).toHaveLength(0);
    });

    it('should return unhealthy status for connection issues', async () => {
      const storeId = 'store-123';
      const existingStore = createMockStore({ id: storeId });

      mockDb.store.findById.mockResolvedValue(existingStore);
      mockEncryption.decrypt.mockReturnValue({ accessToken: 'invalid-token' });
      mockPlatformService.testConnection.mockResolvedValue({
        success: false,
        error: 'Authentication failed',
      });

      const result = await storeService.checkStoreHealth(storeId);

      expect(result.status).toBe('unhealthy');
      expect(result.issues).toContain('Authentication failed');
    });

    it('should return degraded status for partial issues', async () => {
      const storeId = 'store-123';
      const existingStore = createMockStore({ id: storeId });

      mockDb.store.findById.mockResolvedValue(existingStore);
      mockEncryption.decrypt.mockReturnValue({ accessToken: 'valid-token' });
      mockPlatformService.testConnection.mockResolvedValue({
        success: true,
        warnings: ['Rate limit approaching'],
      });

      const result = await storeService.checkStoreHealth(storeId);

      expect(result.status).toBe('degraded');
      expect(result.warnings).toContain('Rate limit approaching');
    });
  });

  describe('updateStoreSettings', () => {
    it('should update store settings successfully', async () => {
      const storeId = 'store-123';
      const existingStore = createMockStore({ id: storeId });
      const newSettings: Partial<StoreSettings> = {
        syncEnabled: false,
        syncInterval: 600,
        autoSync: false,
      };

      mockDb.store.findById.mockResolvedValue(existingStore);
      mockDb.store.update.mockResolvedValue({
        ...existingStore,
        settings: { ...existingStore.settings, ...newSettings },
      });

      const result = await storeService.updateStoreSettings(storeId, newSettings);

      expect(result.settings).toMatchObject(newSettings);
      expect(mockDb.store.update).toHaveBeenCalledWith(storeId, {
        settings: expect.objectContaining(newSettings),
        updatedAt: expect.any(Date),
      });
    });

    it('should validate settings values', async () => {
      const storeId = 'store-123';
      const invalidSettings = {
        syncInterval: -1, // Invalid negative interval
      };

      await expect(
        storeService.updateStoreSettings(storeId, invalidSettings)
      ).rejects.toThrow(AppError);
    });
  });

  describe('performance tests', () => {
    it('should handle store connection efficiently', async () => {
      const startTime = Date.now();
      
      const connectData: ConnectStoreInput = {
        platform: 'shopee',
        name: 'Performance Test Store',
        credentials: { accessToken: 'test-token' },
      };

      mockEncryption.encrypt.mockReturnValue('encrypted');
      mockPlatformService.testConnection.mockResolvedValue({ success: true });
      mockDb.store.create.mockResolvedValue(createMockStore());

      await storeService.connectStore(mockOrganization.id, connectData);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });

    it('should handle multiple health checks efficiently', async () => {
      const storeIds = Array.from({ length: 10 }, (_, i) => `store-${i}`);
      
      mockDb.store.findById.mockResolvedValue(createMockStore());
      mockEncryption.decrypt.mockReturnValue({ accessToken: 'token' });
      mockPlatformService.testConnection.mockResolvedValue({ success: true });

      const startTime = Date.now();
      
      await Promise.all(
        storeIds.map(id => storeService.checkStoreHealth(id))
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('security tests', () => {
    it('should encrypt credentials before storage', async () => {
      const connectData: ConnectStoreInput = {
        platform: 'shopee',
        name: 'Security Test Store',
        credentials: {
          accessToken: 'sensitive-token',
          refreshToken: 'sensitive-refresh',
          apiSecret: 'very-secret-key',
        },
      };

      mockEncryption.encrypt.mockReturnValue('encrypted-data');
      mockPlatformService.testConnection.mockResolvedValue({ success: true });
      mockDb.store.create.mockResolvedValue(createMockStore());

      await storeService.connectStore(mockOrganization.id, connectData);

      expect(mockEncryption.encrypt).toHaveBeenCalledWith(connectData.credentials);
      
      const createCall = mockDb.store.create.mock.calls[0][0];
      expect(createCall.credentials).toBe('encrypted-data');
      expect(createCall.credentials).not.toContain('sensitive-token');
    });

    it('should validate organization ownership', async () => {
      const storeId = 'store-123';
      const unauthorizedOrgId = 'unauthorized-org';
      const store = createMockStore({ organizationId: 'different-org' });

      mockDb.store.findById.mockResolvedValue(store);

      await expect(
        storeService.checkStoreHealth(storeId, unauthorizedOrgId)
      ).rejects.toThrow(AppError);
    });

    it('should sanitize store names', async () => {
      const connectData: ConnectStoreInput = {
        platform: 'shopee',
        name: '<script>alert("xss")</script>Malicious Store',
        credentials: { accessToken: 'token' },
      };

      mockEncryption.encrypt.mockReturnValue('encrypted');
      mockPlatformService.testConnection.mockResolvedValue({ success: true });
      mockDb.store.create.mockResolvedValue(createMockStore());

      await storeService.connectStore(mockOrganization.id, connectData);

      const createCall = mockDb.store.create.mock.calls[0][0];
      expect(createCall.name).not.toContain('<script>');
    });

    it('should handle credential decryption failures gracefully', async () => {
      const storeId = 'store-123';
      const store = createMockStore({ id: storeId });

      mockDb.store.findById.mockResolvedValue(store);
      mockEncryption.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await expect(
        storeService.checkStoreHealth(storeId)
      ).rejects.toThrow(AppError);
    });
  });
});