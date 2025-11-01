import { db } from '@/lib/db';
import { 
  products, 
  productVariants, 
  inventoryItems, 
  inventoryLocations,
  organizations 
} from '@/lib/db/schema';
import { eq, and, desc, asc, sql, like, gte, lte, inArray } from 'drizzle-orm';
import type { 
  SelectProduct, 
  SelectProductVariant, 
  PaginatedResponse,
  PaginationParams 
} from '@/types';

/**
 * Storefront service for public-facing product operations
 * Handles product catalog display, search, and filtering for customers
 */
export class StorefrontService {
  /**
   * Get all active products for storefront display
   */
  async getProducts(params: {
    organizationId?: string;
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'name' | 'price' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<StorefrontProduct>> {
    const {
      organizationId,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      sortBy = 'created_at',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = params;

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(products.isActive, true)
    ];

    if (organizationId) {
      conditions.push(eq(products.organizationId, organizationId));
    }

    if (search) {
      conditions.push(
        sql`(${products.name} ILIKE ${`%${search}%`} OR ${products.description} ILIKE ${`%${search}%`})`
      );
    }

    if (category) {
      conditions.push(eq(products.category, category));
    }

    if (brand) {
      conditions.push(eq(products.brand, brand));
    }

    // Build sort order
    const orderBy = sortOrder === 'asc' ? asc : desc;
    let sortColumn;
    switch (sortBy) {
      case 'name':
        sortColumn = products.name;
        break;
      case 'price':
        // For price sorting, we'll use the minimum variant price
        sortColumn = products.createdAt; // Fallback, will be handled in subquery
        break;
      default:
        sortColumn = products.createdAt;
    }

    // Get products with variants and inventory
    const productsQuery = db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        category: products.category,
        brand: products.brand,
        images: products.images,
        attributes: products.attributes,
        createdAt: products.createdAt,
        variants: sql<StorefrontVariant[]>`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${productVariants.id},
                'variantSku', ${productVariants.variantSku},
                'name', ${productVariants.name},
                'attributes', ${productVariants.attributes},
                'images', ${productVariants.images},
                'price', COALESCE(variant_prices.min_price, 0),
                'compareAtPrice', COALESCE(variant_prices.max_price, 0),
                'quantityAvailable', COALESCE(variant_inventory.total_available, 0),
                'inStock', COALESCE(variant_inventory.total_available, 0) > 0
              )
            ) FILTER (WHERE ${productVariants.id} IS NOT NULL),
            '[]'::json
          )
        `,
        minPrice: sql<number>`COALESCE(product_prices.min_price, 0)`,
        maxPrice: sql<number>`COALESCE(product_prices.max_price, 0)`,
        totalStock: sql<number>`COALESCE(product_inventory.total_stock, 0)`,
        inStock: sql<boolean>`COALESCE(product_inventory.total_stock, 0) > 0`
      })
      .from(products)
      .leftJoin(productVariants, eq(products.id, productVariants.productId))
      .leftJoin(
        sql`(
          SELECT 
            pv.product_id,
            MIN(spm.price) as min_price,
            MAX(spm.compare_at_price) as max_price
          FROM product_variants pv
          LEFT JOIN store_product_mappings spm ON pv.id = spm.product_variant_id
          WHERE spm.is_active = true
          GROUP BY pv.product_id
        ) as product_prices`,
        eq(products.id, sql`product_prices.product_id`)
      )
      .leftJoin(
        sql`(
          SELECT 
            pv.product_id,
            SUM(ii.quantity_on_hand - ii.quantity_reserved) as total_stock
          FROM product_variants pv
          LEFT JOIN inventory_items ii ON pv.id = ii.product_variant_id
          GROUP BY pv.product_id
        ) as product_inventory`,
        eq(products.id, sql`product_inventory.product_id`)
      )
      .leftJoin(
        sql`(
          SELECT 
            pv.id as variant_id,
            MIN(spm.price) as min_price,
            MAX(spm.compare_at_price) as max_price
          FROM product_variants pv
          LEFT JOIN store_product_mappings spm ON pv.id = spm.product_variant_id
          WHERE spm.is_active = true
          GROUP BY pv.id
        ) as variant_prices`,
        eq(productVariants.id, sql`variant_prices.variant_id`)
      )
      .leftJoin(
        sql`(
          SELECT 
            pv.id as variant_id,
            SUM(ii.quantity_on_hand - ii.quantity_reserved) as total_available
          FROM product_variants pv
          LEFT JOIN inventory_items ii ON pv.id = ii.product_variant_id
          GROUP BY pv.id
        ) as variant_inventory`,
        eq(productVariants.id, sql`variant_inventory.variant_id`)
      )
      .where(and(...conditions))
      .groupBy(
        products.id,
        products.sku,
        products.name,
        products.description,
        products.category,
        products.brand,
        products.images,
        products.attributes,
        products.createdAt,
        sql`product_prices.min_price`,
        sql`product_prices.max_price`,
        sql`product_inventory.total_stock`
      )
      .orderBy(orderBy(sortColumn))
      .limit(limit)
      .offset(offset);

    // Apply price filtering if specified
    if (minPrice !== undefined || maxPrice !== undefined) {
      if (minPrice !== undefined) {
        productsQuery.having(gte(sql`COALESCE(product_prices.min_price, 0)`, minPrice));
      }
      if (maxPrice !== undefined) {
        productsQuery.having(lte(sql`COALESCE(product_prices.max_price, 999999)`, maxPrice));
      }
    }

    const [productsResult, totalCountResult] = await Promise.all([
      productsQuery,
      this.getProductsCount(conditions, minPrice, maxPrice)
    ]);

    const totalPages = Math.ceil(totalCountResult / limit);

    return {
      data: productsResult as StorefrontProduct[],
      pagination: {
        page,
        limit,
        total: totalCountResult,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    };
  }

  /**
   * Get product count for pagination
   */
  private async getProductsCount(
    conditions: any[],
    minPrice?: number,
    maxPrice?: number
  ): Promise<number> {
    // Simple count without price filtering for now
    // TODO: Implement proper price filtering in count query
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  /**
   * Get a single product by ID for detail view
   */
  async getProductById(productId: string): Promise<StorefrontProduct | null> {
    const result = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        category: products.category,
        brand: products.brand,
        images: products.images,
        attributes: products.attributes,
        createdAt: products.createdAt,
        variants: sql<StorefrontVariant[]>`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${productVariants.id},
                'variantSku', ${productVariants.variantSku},
                'name', ${productVariants.name},
                'attributes', ${productVariants.attributes},
                'images', ${productVariants.images},
                'price', COALESCE(variant_prices.min_price, 0),
                'compareAtPrice', COALESCE(variant_prices.max_price, 0),
                'quantityAvailable', COALESCE(variant_inventory.total_available, 0),
                'inStock', COALESCE(variant_inventory.total_available, 0) > 0
              )
            ) FILTER (WHERE ${productVariants.id} IS NOT NULL),
            '[]'::json
          )
        `,
        minPrice: sql<number>`COALESCE(product_prices.min_price, 0)`,
        maxPrice: sql<number>`COALESCE(product_prices.max_price, 0)`,
        totalStock: sql<number>`COALESCE(product_inventory.total_stock, 0)`,
        inStock: sql<boolean>`COALESCE(product_inventory.total_stock, 0) > 0`
      })
      .from(products)
      .leftJoin(productVariants, eq(products.id, productVariants.productId))
      .leftJoin(
        sql`(
          SELECT 
            pv.product_id,
            MIN(spm.price) as min_price,
            MAX(spm.compare_at_price) as max_price
          FROM product_variants pv
          LEFT JOIN store_product_mappings spm ON pv.id = spm.product_variant_id
          WHERE spm.is_active = true
          GROUP BY pv.product_id
        ) as product_prices`,
        eq(products.id, sql`product_prices.product_id`)
      )
      .leftJoin(
        sql`(
          SELECT 
            pv.product_id,
            SUM(ii.quantity_on_hand - ii.quantity_reserved) as total_stock
          FROM product_variants pv
          LEFT JOIN inventory_items ii ON pv.id = ii.product_variant_id
          GROUP BY pv.product_id
        ) as product_inventory`,
        eq(products.id, sql`product_inventory.product_id`)
      )
      .leftJoin(
        sql`(
          SELECT 
            pv.id as variant_id,
            MIN(spm.price) as min_price,
            MAX(spm.compare_at_price) as max_price
          FROM product_variants pv
          LEFT JOIN store_product_mappings spm ON pv.id = spm.product_variant_id
          WHERE spm.is_active = true
          GROUP BY pv.id
        ) as variant_prices`,
        eq(productVariants.id, sql`variant_prices.variant_id`)
      )
      .leftJoin(
        sql`(
          SELECT 
            pv.id as variant_id,
            SUM(ii.quantity_on_hand - ii.quantity_reserved) as total_available
          FROM product_variants pv
          LEFT JOIN inventory_items ii ON pv.id = ii.product_variant_id
          GROUP BY pv.id
        ) as variant_inventory`,
        eq(productVariants.id, sql`variant_inventory.variant_id`)
      )
      .where(and(
        eq(products.id, productId),
        eq(products.isActive, true)
      ))
      .groupBy(
        products.id,
        products.sku,
        products.name,
        products.description,
        products.category,
        products.brand,
        products.images,
        products.attributes,
        products.createdAt,
        sql`product_prices.min_price`,
        sql`product_prices.max_price`,
        sql`product_inventory.total_stock`
      );

    return result[0] as StorefrontProduct || null;
  }

  /**
   * Get featured products for homepage
   */
  async getFeaturedProducts(limit: number = 8): Promise<StorefrontProduct[]> {
    const result = await this.getProducts({
      sortBy: 'created_at',
      sortOrder: 'desc',
      limit
    });

    return result.data;
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string, limit: number = 12): Promise<StorefrontProduct[]> {
    const result = await this.getProducts({
      category,
      limit
    });

    return result.data;
  }

  /**
   * Get related products based on category
   */
  async getRelatedProducts(productId: string, category?: string, limit: number = 4): Promise<StorefrontProduct[]> {
    const conditions = [
      eq(products.isActive, true),
      sql`${products.id} != ${productId}`
    ];

    if (category) {
      conditions.push(eq(products.category, category));
    }

    const result = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        category: products.category,
        brand: products.brand,
        images: products.images,
        attributes: products.attributes,
        createdAt: products.createdAt,
        variants: sql<StorefrontVariant[]>`'[]'::json`,
        minPrice: sql<number>`0`,
        maxPrice: sql<number>`0`,
        totalStock: sql<number>`0`,
        inStock: sql<boolean>`true`
      })
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt))
      .limit(limit);

    return result as StorefrontProduct[];
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<string[]> {
    const result = await db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.category} IS NOT NULL`
      ))
      .orderBy(asc(products.category));

    return result.map(r => r.category).filter(Boolean) as string[];
  }

  /**
   * Get all available brands
   */
  async getBrands(): Promise<string[]> {
    const result = await db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.brand} IS NOT NULL`
      ))
      .orderBy(asc(products.brand));

    return result.map(r => r.brand).filter(Boolean) as string[];
  }

  /**
   * Search products by query
   */
  async searchProducts(query: string, limit: number = 20): Promise<StorefrontProduct[]> {
    const result = await this.getProducts({
      search: query,
      limit
    });

    return result.data;
  }
}

/**
 * Storefront-specific product type with pricing and inventory
 */
export interface StorefrontProduct extends Omit<SelectProduct, 'organizationId' | 'costPrice'> {
  variants: StorefrontVariant[];
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  inStock: boolean;
}

/**
 * Storefront-specific variant type with pricing and inventory
 */
export interface StorefrontVariant extends Omit<SelectProductVariant, 'productId' | 'costPrice'> {
  price: number;
  compareAtPrice?: number;
  quantityAvailable: number;
  inStock: boolean;
}