/**
 * TikTok Shop Platform Integration
 * Main exports for TikTok Shop marketplace integration
 */

export { TikTokShopAdapter } from './tiktokshop-adapter';
export { TikTokShopAuth } from './tiktokshop-auth';
export { TikTokShopDataTransformer } from './tiktokshop-transformer';
export { TikTokShopWebhookHandler } from './tiktokshop-webhook';
export { registerTikTokShopAdapter } from './register';

// Auto-register the adapter
import './register';

export type {
  TikTokShopCredentials,
  TikTokShopProduct,
  TikTokShopSku,
  TikTokShopOrder,
  TikTokShopOrderLine,
  TikTokShopApiResponse,
  TikTokShopProductRequest,
  TikTokShopInventoryUpdateRequest,
  TikTokShopWebhookPayload,
  TikTokShopAuthResponse,
  TikTokShopTokenRefreshRequest,
  TikTokShopError,
  TikTokShopCategory,
  TikTokShopBrand,
  TikTokShopAttribute,
  TikTokShopLogistics,
  TikTokShopFileUploadResponse,
  TikTokShopFulfillmentRequest,
  TikTokShopReturn,
  TikTokShopImage,
  TikTokShopVideo,
  TikTokShopPrice,
  TikTokShopInventory,
  TikTokShopSalesAttribute,
  TikTokShopBuyer,
  TikTokShopRecipient,
  TikTokShopDelivery,
  TikTokShopPayment,
  TikTokShopPromotion,
} from './tiktokshop-types';