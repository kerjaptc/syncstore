/**
 * Unit tests for Inventory Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryService } from '@/lib/services/inventory-service';
import { AppError } from '@/lib/error-handling/app-error';
import { createMockInventoryItem, createMockProductVariant } from '../factories';
import type { InventoryItem, InventoryAdjustment, StockReservation } from '@/lib/types';

// Mock dependencies
const mockDb = {
  inventory: {
    findByVariant: vi.fn(),
    findByLocation: vi.fn(),
    update: vi.fn(),
    bulkUpdate: vi.fn(),
    create: vi.fn(),
  },
  inventoryTransaction: {
    create: vi.fn(),
    findByVariant: vi.fn(),
  },
  stockReservation: {
    create: vi.fn(),
    findByOrder: vi.fn(),
    delete: vi.fn(),
    findActive: vi.fn(),
  },
  productVariant: {
    findById: vi.fn(),
  },
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockNotificationService = {
  sendLowStockAlert: vi.fn(),
};

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/error-handling/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/services/notification-service', () => ({ notificationService: mockNotificationService }));

describe('InventoryService', () => {
  let inventoryService: InventoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    inventoryService = new InventoryService();
  });

  describe('updateStock', () => {
    it('should update stock levels successfully', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const newQuantity = 100;

      const existingInventory = createMockInventoryItem({
        productVariantId: variantId,
        locationId,
        quantityOnHand: 50,
        quantityReserved: 10,
      });

      const updatedInventory = {
        ...existingInventory,
        quantityOnHand: newQuantity,
        quantityAvailable: newQuantity - existingInventory.quantityReserved,
      };

      mockDb.inventory.findByVariant.mockResolvedValue(existingInventory);
      mockDb.inventory.update.mockResolvedValue(updatedInventory);
      mockDb.inventoryTransaction.create.mockResolvedValue({});

      const result = await inventoryService.updateStock(variantId, locationId, newQuantity);

      expect(result).toEqual(updatedInventory);
      expect(mockDb.inventory.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          quantityOnHand: newQuantity,
          quantityAvailable: newQuantity - existingInventory.quantityReserved,
        })
      );
      expect(mockDb.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'adjustment',
          quantity: newQuantity - existingInventory.quantityOnHand,
        })
      );
    });

    it('should create new inventory item if not exists', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const quantity = 50;

      const newInventory = createMockInventoryItem({
        productVariantId: variantId,
        locationId,
        quantityOnHand: quantity,
        quantityReserved: 0,
        quantityAvailable: quantity,
      });

      mockDb.inventory.findByVariant.mockResolvedValue(null);
      mockDb.productVariant.findById.mockResolvedValue(createMockProductVariant());
      mockDb.inventory.create.mockResolvedValue(newInventory);

      const result = await inventoryService.updateStock(variantId, locationId, quantity);

      expect(result).toEqual(newInventory);
      expect(mockDb.inventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productVariantId: variantId,
          locationId,
          quantityOnHand: quantity,
          quantityReserved: 0,
          quantityAvailable: quantity,
        })
      );
    });

    it('should prevent negative stock levels', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const negativeQuantity = -10;

      await expect(
        inventoryService.updateStock(variantId, locationId, negativeQuantity)
      ).rejects.toThrow(AppError);
    });

    it('should handle concurrent stock updates safely', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const existingInventory = createMockInventoryItem({
        productVariantId: variantId,
        locationId,
        quantityOnHand: 50,
      });

      mockDb.inventory.findByVariant.mockResolvedValue(existingInventory);
      mockDb.inventory.update.mockResolvedValue(existingInventory);
      mockDb.inventoryTransaction.create.mockResolvedValue({});

      // Simulate concurrent updates
      const updates = [
        inventoryService.updateStock(variantId, locationId, 60),
        inventoryService.updateStock(variantId, locationId, 70),
        inventoryService.updateStock(variantId, locationId, 80),
      ];

      await Promise.all(updates);

      // Should handle all updates without throwing errors
      expect(mockDb.inventory.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('reserveStock', () => {
    it('should reserve stock successfully', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const quantity = 5;
      const orderId = 'order-789';

      const inventory = createMockInventoryItem({
        productVariantId: variantId,
        locationId,
        quantityOnHand: 100,
        quantityReserved: 10,
        quantityAvailable: 90,
      });

      const reservation: StockReservation = {
        id: 'reservation-123',
        orderId,
        productVariantId: variantId,
        locationId,
        quantity,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        createdAt: new Date(),
      };

      mockDb.inventory.findByVariant.mockResolvedValue(inventory);
      mockDb.stockReservation.create.mockResolvedValue(reservation);
      mockDb.inventory.update.mockResolvedValue({
        ...inventory,
        quantityReserved: inventory.quantityReserved + quantity,
        quantityAvailable: inventory.quantityAvailable - quantity,
      });

      await inventoryService.reserveStock(variantId, locationId, quantity, orderId);

      expect(mockDb.stockReservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId,
          productVariantId: variantId,
          locationId,
          quantity,
        })
      );
      expect(mockDb.inventory.update).toHaveBeenCalledWith(
        inventory.id,
        expect.objectContaining({
          quantityReserved: inventory.quantityReserved + quantity,
          quantityAvailable: inventory.quantityAvailable - quantity,
        })
      );
    });

    it('should throw error when insufficient stock available', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const quantity = 100;
      const orderId = 'order-789';

      const inventory = createMockInventoryItem({
        productVariantId: variantId,
        locationId,
        quantityOnHand: 50,
        quantityReserved: 10,
        quantityAvailable: 40,
      });

      mockDb.inventory.findByVariant.mkResolvedValue(inventory);

      await expect(
        inventoryService.reserveStock(variantId, locationId, quantity, orderId)
      ).rejects.toThrow(AppError);

      expect(mockDb.stockReservation.create).not.toHaveBeenCalled();
    });

    it('should handle reservation expiration', async () => {
      const expiredReservations = [
        {
          id: 'reservation-1',
          orderId: 'order-1',
          productVariantId: 'variant-123',
          locationId: 'location-456',
          quantity: 5,
          expiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
        },
      ];

      mockDb.stockReservation.findActive.mockResolvedValue(expiredReservations);
      mockDb.stockReservation.delete.mockResolvedValue(true);
      mockDb.inventory.findByVariant.mockResolvedValue(createMockInventoryItem());
      mockDb.inventory.update.mockResolvedValue(createMockInventoryItem());

      await inventoryService.cleanupExpiredReservations();

      expect(mockDb.stockReservation.delete).toHaveBeenCalledWith('reservation-1');
    });
  });

  describe('releaseReservation', () => {
    it('should release stock reservation successfully', async () => {
      const orderId = 'order-789';
      const reservations = [
        {
          id: 'reservation-1',
          orderId,
          productVariantId: 'variant-123',
          locationId: 'location-456',
          quantity: 5,
        },
      ];

      const inventory = createMockInventoryItem({
        quantityReserved: 15,
        quantityAvailable: 85,
      });

      mockDb.stockReservation.findByOrder.mockResolvedValue(reservations);
      mockDb.inventory.findByVariant.mockResolvedValue(inventory);
      mockDb.stockReservation.delete.mockResolvedValue(true);
      mockDb.inventory.update.mockResolvedValue({
        ...inventory,
        quantityReserved: inventory.quantityReserved - 5,
        quantityAvailable: inventory.quantityAvailable + 5,
      });

      await inventoryService.releaseReservation(orderId);

      expect(mockDb.stockReservation.delete).toHaveBeenCalledWith('reservation-1');
      expect(mockDb.inventory.update).toHaveBeenCalledWith(
        inventory.id,
        expect.objectContaining({
          quantityReserved: inventory.quantityReserved - 5,
          quantityAvailable: inventory.quantityAvailable + 5,
        })
      );
    });
  });

  describe('getAvailableStock', () => {
    it('should return available stock for variant', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';

      const inventory = createMockInventoryItem({
        productVariantId: variantId,
        locationId,
        quantityOnHand: 100,
        quantityReserved: 20,
        quantityAvailable: 80,
      });

      mockDb.inventory.findByVariant.mockResolvedValue(inventory);

      const result = await inventoryService.getAvailableStock(variantId, locationId);

      expect(result).toBe(80);
    });

    it('should return total available stock across all locations', async () => {
      const variantId = 'variant-123';

      const inventoryItems = [
        createMockInventoryItem({ quantityAvailable: 50 }),
        createMockInventoryItem({ quantityAvailable: 30 }),
        createMockInventoryItem({ quantityAvailable: 20 }),
      ];

      mockDb.inventory.findByVariant.mockResolvedValue(inventoryItems);

      const result = await inventoryService.getAvailableStock(variantId);

      expect(result).toBe(100); // 50 + 30 + 20
    });

    it('should return 0 for non-existent variant', async () => {
      const variantId = 'non-existent';

      mockDb.inventory.findByVariant.mockResolvedValue(null);

      const result = await inventoryService.getAvailableStock(variantId);

      expect(result).toBe(0);
    });
  });

  describe('getLowStockItems', () => {
    it('should return items below reorder point', async () => {
      const organizationId = 'org-123';
      const lowStockItems = [
        createMockInventoryItem({
          quantityAvailable: 5,
          reorderPoint: 10,
        }),
        createMockInventoryItem({
          quantityAvailable: 2,
          reorderPoint: 15,
        }),
      ];

      mockDb.inventory.findByLocation.mockResolvedValue(lowStockItems);

      const result = await inventoryService.getLowStockItems(organizationId);

      expect(result).toEqual(lowStockItems);
      expect(mockNotificationService.sendLowStockAlert).toHaveBeenCalledWith(
        organizationId,
        lowStockItems
      );
    });
  });

  describe('adjustInventory', () => {
    it('should process bulk inventory adjustments', async () => {
      const adjustments: InventoryAdjustment[] = [
        {
          variantId: 'variant-1',
          locationId: 'location-1',
          quantityChange: 10,
          reason: 'restock',
        },
        {
          variantId: 'variant-2',
          locationId: 'location-1',
          quantityChange: -5,
          reason: 'damage',
        },
      ];

      const inventoryItems = [
        createMockInventoryItem({ quantityOnHand: 50 }),
        createMockInventoryItem({ quantityOnHand: 30 }),
      ];

      mockDb.inventory.findByVariant.mockResolvedValue(inventoryItems[0]);
      mockDb.inventory.bulkUpdate.mockResolvedValue(true);
      mockDb.inventoryTransaction.create.mockResolvedValue({});

      await inventoryService.adjustInventory(adjustments);

      expect(mockDb.inventory.bulkUpdate).toHaveBeenCalled();
      expect(mockDb.inventoryTransaction.create).toHaveBeenCalledTimes(2);
    });

    it('should validate adjustment reasons', async () => {
      const invalidAdjustments: InventoryAdjustment[] = [
        {
          variantId: 'variant-1',
          locationId: 'location-1',
          quantityChange: 10,
          reason: '', // Invalid empty reason
        },
      ];

      await expect(
        inventoryService.adjustInventory(invalidAdjustments)
      ).rejects.toThrow(AppError);
    });
  });

  describe('performance tests', () => {
    it('should handle bulk stock updates efficiently', async () => {
      const startTime = Date.now();
      const updates = Array.from({ length: 100 }, (_, i) => ({
        variantId: `variant-${i}`,
        locationId: 'location-1',
        quantityChange: 10,
        reason: 'bulk-update',
      }));

      mockDb.inventory.findByVariant.mockResolvedValue(createMockInventoryItem());
      mockDb.inventory.bulkUpdate.mockResolvedValue(true);
      mockDb.inventoryTransaction.create.mockResolvedValue({});

      await inventoryService.adjustInventory(updates);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle concurrent reservations efficiently', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const inventory = createMockInventoryItem({
        quantityAvailable: 1000,
      });

      mockDb.inventory.findByVariant.mockResolvedValue(inventory);
      mockDb.stockReservation.create.mockResolvedValue({});
      mockDb.inventory.update.mockResolvedValue(inventory);

      const startTime = Date.now();
      const reservations = Array.from({ length: 50 }, (_, i) =>
        inventoryService.reserveStock(variantId, locationId, 1, `order-${i}`)
      );

      await Promise.all(reservations);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('security tests', () => {
    it('should validate inventory access by organization', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const unauthorizedOrgId = 'unauthorized-org';

      const inventory = createMockInventoryItem({
        // Belongs to different organization
      });

      mockDb.inventory.findByVariant.mockResolvedValue(inventory);

      await expect(
        inventoryService.updateStock(variantId, locationId, 100, unauthorizedOrgId)
      ).rejects.toThrow(AppError);
    });

    it('should prevent inventory manipulation through invalid inputs', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';

      // Test with SQL injection attempt
      const maliciousQuantity = "100; DROP TABLE inventory; --" as any;

      await expect(
        inventoryService.updateStock(variantId, locationId, maliciousQuantity)
      ).rejects.toThrow(AppError);
    });

    it('should audit all inventory changes', async () => {
      const variantId = 'variant-123';
      const locationId = 'location-456';
      const quantity = 100;

      const inventory = createMockInventoryItem();
      mockDb.inventory.findByVariant.mockResolvedValue(inventory);
      mockDb.inventory.update.mockResolvedValue(inventory);
      mockDb.inventoryTransaction.create.mockResolvedValue({});

      await inventoryService.updateStock(variantId, locationId, quantity);

      expect(mockDb.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'adjustment',
          userId: expect.any(String),
          timestamp: expect.any(Date),
        })
      );
    });
  });
});