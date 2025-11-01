/**
 * Product Service
 * Handles master product catalog and variant management
 */

import { db } from '@/lib/db';
import { products, productVariants, organizations } from '@/lib/db/schema';
import { eq, and, desc, count, like, ilike, or, sql } from 'drizzle-orm';
import { generateSku, createSearchCondition, withPagination, createPaginatedResponse } from '@/lib/db/utils';
import { FileUploadService } from './file-upload-service';
import type {
  // SelectProduct, // TODO: Define proper types 
  SelectProduct, 
  SelectProductVariant,
  ProductWithVariants,
  ProductVariantWithInventory,
  PaginationParams,
  PaginatedResponse
} from '@/lib/types-patch';

export class ProductService {
  private fileUploadService: FileUploadService;

  constructor() {
    this.fileUploadService = new FileUploadService();
  }

  /**
   * Helper method to safely cast variant data
   */
  private castVariantData(variant: any): any {
    return {
      ...variant,
      images: Array.isArray(variant.images) ? variant.images : [],
      attributes: typeof variant.attributes === 'object' && variant.attributes !== null ? variant.attributes : {},
    };
  }

  /**
   * Helper method to safely cast product data
   */
  private castProductData(product: any): any {
    return {
      ...product,
      images: Array.isArray(product.images) ? product.images : [],
      attributes: typeof product.attributes === 'object' && product.attributes !== null ? product.attributes : {},
      dimensions: typeof product.dimensions === 'object' && product.dimensions !== null ? product.dimensions : {},
    };
  }

  /**
   * Create a new product with optional variants
   */
  async createProduct(data: {
    organizationId: string;
    sku?: string;
    name: string;
    description?: string;
    category?: string;
    brand?: string;
    costPrice?: number;
    weight?: number;
    dimensions?: { length?: number; width?: number; height?: number };
    images?: string[];
    attributes?: Record<string, any>;
    variants?: Array<{
      variantSku?: string;
      name: string;
      attributes?: Record<string, any>;
      costPrice?: number;
      weight?: number;
      images?: string[];
    }>;
  }): Promise<ProductWithVariants> {
    return await db.transaction(async (tx) => {
      // Generate SKU if not provided
      const productSku = data.sku || generateSku('PRD');

      // Check if SKU already exists in organization
      const existingProduct = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(
          eq(products.organizationId, data.organizationId),
          eq(products.sku, productSku)
        ))
        .limit(1);

      if (existingProduct.length > 0) {
        throw new Error(`Product with SKU "${productSku}" already exists`);
      }

      // Create product
      const [product] = await tx
        .insert(products)
        .values({
          organizationId: data.organizationId,
          sku: productSku,
          name: data.name,
          description: data.description,
          category: data.category,
          brand: data.brand,
          costPrice: data.costPrice?.toString(),
          weight: data.weight?.toString(),
          dimensions: data.dimensions,
          images: data.images || [],
          attributes: data.attributes || {},
          isActive: true,
        })
        .returning();

      // Create variants if provided
      const variants: SelectProductVariant[] = [];
      if (data.variants && data.variants.length > 0) {
        for (const variantData of data.variants) {
          const variantSku = variantData.variantSku || generateSku('VAR');

          const [variant] = await tx
            .insert(productVariants)
            .values({
              productId: product.id,
              variantSku,
              name: variantData.name,
              attributes: variantData.attributes || {},
              costPrice: variantData.costPrice?.toString(),
              weight: variantData.weight?.toString(),
              images: variantData.images || [],
              isActive: true,
            })
            .returning();

          variants.push(this.castVariantData(variant) as SelectProductVariant);
        }
      } else {
        // Create default variant if no variants specified
        const [defaultVariant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            variantSku: `${productSku}-DEFAULT`,
            name: data.name,
            attributes: {},
            costPrice: data.costPrice?.toString(),
            weight: data.weight?.toString(),
            images: data.images || [],
            isActive: true,
          })
          .returning();

        variants.push(this.castVariantData(defaultVariant) as SelectProductVariant);
      }

      // Get organization data
      const [organization] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, data.organizationId))
        .limit(1);

      return {
        ...this.castProductData(product),
        organization,
        variants: variants.map(variant => ({
          ...variant,
          product: this.castProductData(product),
          inventoryItems: [],
          totalQuantityOnHand: 0,
          totalQuantityAvailable: 0,
        })) as ProductVariantWithInventory[],
        _count: {
          variants: variants.length,
        },
      } as ProductWithVariants;
    });
  }

  /**
   * Get product with variants and inventory data
   */
  async getProductWithVariants(productId: string, organizationId: string): Promise<ProductWithVariants | null> {
    // Get product
    const productResult = await db
      .select({
        id: products.id,
        organizationId: products.organizationId,
        sku: products.sku,
        name: products.name,
        description: products.description,
        category: products.category,
        brand: products.brand,
        costPrice: products.costPrice,
        weight: products.weight,
        dimensions: products.dimensions,
        images: products.images,
        attributes: products.attributes,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
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
      .from(products)
      .innerJoin(organizations, eq(products.organizationId, organizations.id))
      .where(and(
        eq(products.id, productId),
        eq(products.organizationId, organizationId)
      ))
      .limit(1);

    if (productResult.length === 0) return null;

    const product = productResult[0];

    // Get variants
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(productVariants.createdAt);

    const variantsWithInventory = variants.map(variant => ({
      ...this.castVariantData(variant),
      product: this.castProductData(product),
      inventoryItems: [],
      totalQuantityOnHand: 0,
      totalQuantityAvailable: 0,
    })) as ProductVariantWithInventory[];

    return {
      ...product,
      images: Array.isArray(product.images) ? product.images : [],
      attributes: typeof product.attributes === 'object' && product.attributes !== null ? product.attributes : {},
      dimensions: typeof product.dimensions === 'object' && product.dimensions !== null ? product.dimensions : {},
      variants: variantsWithInventory,
      _count: {
        variants: variants.length,
      },
    } as ProductWithVariants;
  }

  /**
   * Update product information
   */
  async updateProduct(
    productId: string,
    organizationId: string,
    data: Partial<{
      name: string;
      description: string;
      category: string;
      brand: string;
      costPrice: number;
      weight: number;
      dimensions: { length?: number; width?: number; height?: number };
      images: string[];
      attributes: Record<string, any>;
      isActive: boolean;
    }>,
    userId?: string
  ): Promise<SelectProduct | null> {
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // Convert numbers to strings for decimal fields
    if (data.costPrice !== undefined) {
      updateData.costPrice = data.costPrice.toString();
    }
    if (data.weight !== undefined) {
      updateData.weight = data.weight.toString();
    }

    const [product] = await db
      .update(products)
      .set(updateData)
      .where(and(
        eq(products.id, productId),
        eq(products.organizationId, organizationId)
      ))
      .returning();

    return product ? this.castProductData(product) as SelectProduct : null;
  }

  /**
   * Upload product images
   */
  async uploadProductImages(files: File[]): Promise<string[]> {
    try {
      const uploadResults = await this.fileUploadService.uploadFiles(files, 'products');
      return uploadResults.map(result => result.url);
    } catch (error) {
      throw new Error(`Failed to upload product images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload variant images
   */
  async uploadVariantImages(files: File[]): Promise<string[]> {
    try {
      const uploadResults = await this.fileUploadService.uploadFiles(files, 'variants');
      return uploadResults.map(result => result.url);
    } catch (error) {
      throw new Error(`Failed to upload variant images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete product image
   */
  async deleteProductImage(
    productId: string,
    organizationId: string,
    imageUrl: string,
    userId: string
  ): Promise<void> {
    // Get current product
    const product = await this.getProductWithVariants(productId, organizationId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Remove image from product images array
    const currentImages = Array.isArray(product.images) ? product.images as string[] : [];
    const updatedImages = currentImages.filter(img => img !== imageUrl);

    // Update product
    await this.updateProduct(productId, organizationId, {
      images: updatedImages,
    });

    // Delete physical file
    await this.fileUploadService.deleteFile(imageUrl);
  }

  /**
   * Search products with pagination and filters
   */
  async searchProducts(
    organizationId: string,
    options: {
      search?: string;
      category?: string;
      brand?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
      sortBy?: 'name' | 'sku' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<PaginatedResponse<ProductWithVariants>> {
    const {
      search,
      category,
      brand,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build where conditions
    const conditions = [eq(products.organizationId, organizationId)];

    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.description, `%${search}%`)
        )!
      );
    }

    if (category) {
      conditions.push(eq(products.category, category));
    }

    if (brand) {
      conditions.push(eq(products.brand, brand));
    }

    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }

    // Build order by
    let orderBy;
    switch (sortBy) {
      case 'name':
        orderBy = sortOrder === 'asc' ? products.name : desc(products.name);
        break;
      case 'sku':
        orderBy = sortOrder === 'asc' ? products.sku : desc(products.sku);
        break;
      case 'updatedAt':
        orderBy = sortOrder === 'asc' ? products.updatedAt : desc(products.updatedAt);
        break;
      case 'createdAt':
      default:
        orderBy = sortOrder === 'asc' ? products.createdAt : desc(products.createdAt);
        break;
    }

    // Get products
    const offset = (page - 1) * limit;
    const productResults = await db
      .select({
        id: products.id,
        organizationId: products.organizationId,
        sku: products.sku,
        name: products.name,
        description: products.description,
        category: products.category,
        brand: products.brand,
        costPrice: products.costPrice,
        weight: products.weight,
        dimensions: products.dimensions,
        images: products.images,
        attributes: products.attributes,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
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
      .from(products)
      .innerJoin(organizations, eq(products.organizationId, organizations.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(products)
      .where(and(...conditions));

    // Get variants for each product
    const productsWithVariants: ProductWithVariants[] = [];
    for (const product of productResults) {
      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, product.id))
        .orderBy(productVariants.createdAt);

      const variantsWithInventory = variants.map(variant => ({
        ...this.castVariantData(variant),
        product: this.castProductData(product),
        inventoryItems: [],
        totalQuantityOnHand: 0,
        totalQuantityAvailable: 0,
      })) as ProductVariantWithInventory[];

      productsWithVariants.push({
        ...this.castProductData(product),
        variants: variantsWithInventory,
        _count: {
          variants: variants.length,
        },
      } as ProductWithVariants);
    }

    return createPaginatedResponse(productsWithVariants, total, { page, limit });
  }

  /**
   * Get product categories for organization
   */
  async getCategories(organizationId: string): Promise<string[]> {
    const result = await db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true)
      ))
      .orderBy(products.category);

    return result
      .map(row => row.category)
      .filter(category => category !== null) as string[];
  }

  /**
   * Get product brands for organization
   */
  async getBrands(organizationId: string): Promise<string[]> {
    const result = await db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true)
      ))
      .orderBy(products.brand);

    return result
      .map(row => row.brand)
      .filter(brand => brand !== null) as string[];
  }

  /**
   * Bulk import products from CSV or JSON data
   */
  async bulkImportProducts(
    organizationId: string,
    productsData: Array<{
      sku?: string;
      name: string;
      description?: string;
      category?: string;
      brand?: string;
      costPrice?: number;
      weight?: number;
      images?: string[];
      attributes?: Record<string, any>;
      variants?: Array<{
        variantSku?: string;
        name: string;
        attributes?: Record<string, any>;
        costPrice?: number;
        weight?: number;
        images?: string[];
      }>;
    }>
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };

    for (let i = 0; i < productsData.length; i++) {
      try {
        await this.createProduct({
          organizationId,
          ...productsData[i],
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get product statistics for organization
   */
  async getProductStats(organizationId: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    totalVariants: number;
    categoriesCount: number;
    brandsCount: number;
    lowStockProducts: number;
    productsWithImages: number;
    productsWithoutImages: number;
  }> {
    // Get product counts
    const [productStats] = await db
      .select({
        total: count(),
        active: sql<number>`COUNT(CASE WHEN ${products.isActive} = true THEN 1 END)`,
        withImages: sql<number>`COUNT(CASE WHEN array_length(${products.images}, 1) > 0 THEN 1 END)`,
        withoutImages: sql<number>`COUNT(CASE WHEN array_length(${products.images}, 1) IS NULL OR array_length(${products.images}, 1) = 0 THEN 1 END)`,
      })
      .from(products)
      .where(eq(products.organizationId, organizationId));

    // Get variant count
    const [variantStats] = await db
      .select({ total: count() })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(products.organizationId, organizationId));

    // Get categories count
    const [categoryStats] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${products.category})` })
      .from(products)
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true)
      ));

    // Get brands count
    const [brandStats] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${products.brand})` })
      .from(products)
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true)
      ));

    return {
      totalProducts: productStats.total,
      activeProducts: productStats.active,
      totalVariants: variantStats.total,
      categoriesCount: categoryStats.count,
      brandsCount: brandStats.count,
      lowStockProducts: 0, // TODO: Implement when inventory service is available
      productsWithImages: productStats.withImages,
      productsWithoutImages: productStats.withoutImages,
    };
  }
}