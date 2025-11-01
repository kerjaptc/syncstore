/**
 * Shopee Platform Integration
 * Main exports for Shopee marketplace integration
 */

export { ShopeeAdapter } from './shopee-adapter';
export { ShopeeAuth } from './shopee-auth';
export { ShopeeDataTransformer } from './shopee-transformer';
export { ShopeeWebhookHandler } from './shopee-webhook';
export { registerShopeeAdapter } from './register';

// Auto-register the adapter
import './register';

export type {
  ShopeeCredentials,
  ShopeeProduct,
  ShopeeProductVariant,
  ShopeeOrder,
  ShopeeOrderItem,
  ShopeeApiResponse,
  ShopeeProductRequest,
  ShopeeInventoryUpdateRequest,
  ShopeeWebhookPayload,
  ShopeeAuthResponse,
  ShopeeTokenRefreshRequest,
  ShopeeError,
  ShopeeCommonParams,
  ShopeeLogistics,
  ShopeeCategory,
  ShopeeBrand,
  ShopeeImageUploadResponse,
} from './shopee-types';