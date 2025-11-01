/**
 * Shopee Adapter Registration
 * Automatically registers the Shopee adapter with the factory
 */

import { PlatformAdapterFactory, DEFAULT_PLATFORM_CONFIGS } from '../adapter-factory';
import { ShopeeAdapter } from './shopee-adapter';

// Register Shopee adapter
PlatformAdapterFactory.registerAdapter(
  'shopee',
  ShopeeAdapter,
  DEFAULT_PLATFORM_CONFIGS.shopee
);

// Export for manual registration if needed
export const registerShopeeAdapter = () => {
  PlatformAdapterFactory.registerAdapter(
    'shopee',
    ShopeeAdapter,
    DEFAULT_PLATFORM_CONFIGS.shopee
  );
};