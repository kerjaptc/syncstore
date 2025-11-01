
// Temporary type definitions for missing imports
export type SelectProduct = {
  id: string;
  name: string;
  sku: string;
  organizationId: string;
};

export type SelectStore = {
  id: string;
  name: string;
  organizationId: string;
  platformId: string;
};

export type SelectProductVariant = {
  id: string;
  productId: string;
  name: string;
  sku: string;
};

export type InsertUser = {
  id: string;
  email: string;
  organizationId: string;
};

export type SelectUser = InsertUser & {
  createdAt: Date;
  updatedAt: Date;
};

export type InsertOrganization = {
  name: string;
  slug: string;
};

export type SelectOrganization = InsertOrganization & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationWithUsers = SelectOrganization & {
  users: SelectUser[];
};

export type ProductVariantWithInventory = SelectProductVariant & {
  inventory: {
    quantity: number;
    reserved: number;
  };
};

export type SelectStoreProductMapping = {
  id: string;
  storeId: string;
  localProductId: string;
  platformProductId: string;
};

export type SyncStatus = 'active' | 'inactive' | 'syncing' | 'error';

export type CreateProductInput = {
  name: string;
  sku: string;
  description?: string;
  organizationId: string;
};
