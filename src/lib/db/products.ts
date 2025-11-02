/**
 * Product Data Access Layer
 * Handles all database operations for products with proper error handling and logging
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Direct database connection for products module
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(client, {
  logger: false,
});
import { products, productVariants, organizations, inventoryLocations, inventoryItems } from '@/lib/db/schema';
import { eq, and, like, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

// Types for Phase 4
export interface ProductData {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  costPrice: string | null;
  weight: string | null;
  dimensions: any;
  images: any;
  attributes: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantData {
  id: string;
  productId: string;
  variantSku: string;
  name: string | null;
  attributes: any;
  costPrice: string | null;
  weight: string | null;
  images: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductWithVariants extends ProductData {
  variants: ProductVariantData[];
  stock?: number;
  syncStatus?: 'synced' | 'pending' | 'error';
  lastSyncAt?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Validation schemas
const productCreateSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  costPrice: z.string().optional(),
  weight: z.string().optional(),
  dimensions: z.any().optional(),
  images: z.array(z.string()).default([]),
  attributes: z.record(z.any()).default({}),
  isActive: z.boolean().default(true)
});

/**
 * Log database operations with timing
 */
function logOperation(operation: string, duration: number, resultCount?: number): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const result = resultCount !== undefined ? ` result=${resultCount} items` : '';
  console.log(`[${timestamp}] [DB] ${operation} duration=${duration}ms${result}`);
}

/**
 * Database connection health check
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; error?: string; responseTime: number }> {
  const startTime = Date.now();
  
  try {
    await db.execute('SELECT 1');
    const responseTime = Date.now() - startTime;
    logOperation('Health Check', responseTime);
    
    return {
      healthy: true,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logOperation('Health Check FAILED', responseTime);
    
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    };
  }
}

/**
 * Get or create default organization for Phase 4 testing
 */
export async function getOrCreateDefaultOrganization(): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Try to find existing organization
    const existingOrgs = await db.select().from(organizations).limit(1);
    
    if (existingOrgs.length > 0) {
      logOperation('Get Organization', Date.now() - startTime, 1);
      return existingOrgs[0].id;
    }
    
    // Create default organization
    const orgId = crypto.randomUUID();
    await db.insert(organizations).values({
      id: orgId,
      name: 'SyncStore Phase 4 Demo',
      slug: 'syncstore-phase4-demo',
      settings: {},
      subscriptionPlan: 'free'
    });
    
    logOperation('Create Organization', Date.now() - startTime, 1);
    return orgId;
  } catch (error) {
    logOperation('Get/Create Organization FAILED', Date.now() - startTime);
    throw new Error(`Failed to get/create organization: ${error}`);
  }
}

/**
 * Get all products with pagination and search
 */
export async function getProducts(params: PaginationParams): Promise<PaginatedResult<ProductWithVariants>> {
  const startTime = Date.now();
  const { page = 1, limit = 20, search, category, sortBy = 'createdAt', sortOrder = 'desc' } = params;
  const offset = (page - 1) * limit;
  
  try {
    // Get organization ID
    const orgId = await getOrCreateDefaultOrganization();
    
    // Build where conditions
    let whereConditions = eq(products.organizationId, orgId);
    
    if (search) {
      whereConditions = and(
        whereConditions,
        like(products.name, `%${search}%`)
      );
    }
    
    if (category) {
      whereConditions = and(
        whereConditions,
        eq(products.category, category)
      );
    }
    
    // Build order by
    const orderBy = sortOrder === 'asc' 
      ? asc(products[sortBy as keyof typeof products])
      : desc(products[sortBy as keyof typeof products]);
    
    // Get products with count
    const [productsResult, countResult] = await Promise.all([
      db.select()
        .from(products)
        .where(whereConditions)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db.select({ count: products.id })
        .from(products)
        .where(whereConditions)
    ]);
    
    const total = countResult.length;
    const totalPages = Math.ceil(total / limit);
    
    // Get variants for each product
    const productsWithVariants: ProductWithVariants[] = [];
    
    for (const product of productsResult) {
      const variants = await db.select()
        .from(productVariants)
        .where(eq(productVariants.productId, product.id));
      
      // Calculate total stock from inventory
      let totalStock = 0;
      for (const variant of variants) {
        const inventory = await db.select()
          .from(inventoryItems)
          .where(eq(inventoryItems.productVariantId, variant.id));
        
        totalStock += inventory.reduce((sum, item) => sum + (item.quantityOnHand - item.quantityReserved), 0);
      }
      
      productsWithVariants.push({
        ...product,
        variants,
        stock: totalStock,
        syncStatus: 'pending', // Default for Phase 4
        lastSyncAt: undefined
      });
    }
    
    logOperation(`Get Products (page ${page})`, Date.now() - startTime, productsResult.length);
    
    return {
      data: productsWithVariants,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  } catch (error) {
    logOperation('Get Products FAILED', Date.now() - startTime);
    throw new Error(`Failed to get products: ${error}`);
  }
}

/**
 * Get single product by ID
 */
export async function getProductById(id: string): Promise<ProductWithVariants | null> {
  const startTime = Date.now();
  
  try {
    const product = await db.select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    
    if (product.length === 0) {
      logOperation('Get Product By ID', Date.now() - startTime, 0);
      return null;
    }
    
    const variants = await db.select()
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    
    // Calculate stock
    let totalStock = 0;
    for (const variant of variants) {
      const inventory = await db.select()
        .from(inventoryItems)
        .where(eq(inventoryItems.productVariantId, variant.id));
      
      totalStock += inventory.reduce((sum, item) => sum + (item.quantityOnHand - item.quantityReserved), 0);
    }
    
    logOperation('Get Product By ID', Date.now() - startTime, 1);
    
    return {
      ...product[0],
      variants,
      stock: totalStock,
      syncStatus: 'pending',
      lastSyncAt: undefined
    };
  } catch (error) {
    logOperation('Get Product By ID FAILED', Date.now() - startTime);
    throw new Error(`Failed to get product: ${error}`);
  }
}

/**
 * Create new product with validation
 */
export async function createProduct(data: z.infer<typeof productCreateSchema>): Promise<ProductData> {
  const startTime = Date.now();
  
  try {
    // Validate input
    const validatedData = productCreateSchema.parse(data);
    
    // Get organization ID
    const orgId = await getOrCreateDefaultOrganization();
    
    // Check if SKU already exists
    const existingProduct = await db.select()
      .from(products)
      .where(and(
        eq(products.organizationId, orgId),
        eq(products.sku, validatedData.sku)
      ))
      .limit(1);
    
    if (existingProduct.length > 0) {
      throw new Error(`Product with SKU '${validatedData.sku}' already exists`);
    }
    
    // Create product
    const productId = crypto.randomUUID();
    const newProduct = {
      id: productId,
      organizationId: orgId,
      ...validatedData
    };
    
    await db.insert(products).values(newProduct);
    
    logOperation('Create Product', Date.now() - startTime, 1);
    
    return newProduct as ProductData;
  } catch (error) {
    logOperation('Create Product FAILED', Date.now() - startTime);
    throw error;
  }
}

/**
 * Update product
 */
export async function updateProduct(id: string, data: Partial<z.infer<typeof productCreateSchema>>): Promise<ProductData | null> {
  const startTime = Date.now();
  
  try {
    const updatedProducts = await db.update(products)
      .set({
        ...data,
        updatedAt: new Date().toISOString()
      })
      .where(eq(products.id, id))
      .returning();
    
    if (updatedProducts.length === 0) {
      logOperation('Update Product', Date.now() - startTime, 0);
      return null;
    }
    
    logOperation('Update Product', Date.now() - startTime, 1);
    return updatedProducts[0] as ProductData;
  } catch (error) {
    logOperation('Update Product FAILED', Date.now() - startTime);
    throw new Error(`Failed to update product: ${error}`);
  }
}

/**
 * Delete product
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    const deletedProducts = await db.delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });
    
    const success = deletedProducts.length > 0;
    logOperation('Delete Product', Date.now() - startTime, success ? 1 : 0);
    
    return success;
  } catch (error) {
    logOperation('Delete Product FAILED', Date.now() - startTime);
    throw new Error(`Failed to delete product: ${error}`);
  }
}

/**
 * Get product count for dashboard stats
 */
export async function getProductCount(): Promise<number> {
  const startTime = Date.now();
  
  try {
    const orgId = await getOrCreateDefaultOrganization();
    
    const result = await db.select({ count: products.id })
      .from(products)
      .where(eq(products.organizationId, orgId));
    
    const count = result.length;
    logOperation('Get Product Count', Date.now() - startTime, count);
    
    return count;
  } catch (error) {
    logOperation('Get Product Count FAILED', Date.now() - startTime);
    throw new Error(`Failed to get product count: ${error}`);
  }
}

/**
 * Test data persistence across connections
 */
export async function testDataPersistence(): Promise<{ success: boolean; message: string; details: any }> {
  const startTime = Date.now();
  
  try {
    // Test 1: Create a test product
    const testProduct = await createProduct({
      sku: `TEST-PERSIST-${Date.now()}`,
      name: 'Test Persistence Product',
      description: 'This product tests data persistence',
      category: 'Test',
      brand: 'TestBrand',
      costPrice: '10.00',
      weight: '100.0'
    });
    
    // Test 2: Retrieve the product
    const retrievedProduct = await getProductById(testProduct.id);
    
    if (!retrievedProduct) {
      throw new Error('Product not found after creation');
    }
    
    // Test 3: Update the product
    const updatedProduct = await updateProduct(testProduct.id, {
      name: 'Updated Test Product'
    });
    
    if (!updatedProduct || updatedProduct.name !== 'Updated Test Product') {
      throw new Error('Product update failed');
    }
    
    // Test 4: Clean up
    await deleteProduct(testProduct.id);
    
    const details = {
      created: testProduct,
      retrieved: retrievedProduct,
      updated: updatedProduct,
      executionTime: Date.now() - startTime
    };
    
    logOperation('Test Data Persistence', Date.now() - startTime);
    
    return {
      success: true,
      message: 'Data persistence test passed successfully',
      details
    };
  } catch (error) {
    logOperation('Test Data Persistence FAILED', Date.now() - startTime);
    
    return {
      success: false,
      message: `Data persistence test failed: ${error}`,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

export default {
  checkDatabaseHealth,
  getOrCreateDefaultOrganization,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductCount,
  testDataPersistence
};