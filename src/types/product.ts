/**
 * Product-related types
 */

export interface CreateProductInput {
  name: string;
  description?: string;
  sku?: string;
  price: number;
  categoryId?: string;
  organizationId: string;
  variants?: ProductVariantInput[];
}

export interface ProductVariantInput {
  name: string;
  sku?: string;
  price?: number;
  attributes?: Record<string, any>;
}
