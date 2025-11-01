/**
 * TikTok Shop Adapter Registration
 * Automatically registers the TikTok Shop adapter with the factory
 */

import { PlatformAdapterFactory, DEFAULT_PLATFORM_CONFIGS } from '../adapter-factory';
import { TikTokShopAdapter } from './tiktokshop-adapter';

// Register TikTok Shop adapter
PlatformAdapterFactory.registerAdapter(
  'tiktokshop',
  TikTokShopAdapter,
  DEFAULT_PLATFORM_CONFIGS.tiktokshop
);

// Export for manual registration if needed
export const registerTikTokShopAdapter = () => {
  PlatformAdapterFactory.registerAdapter(
    'tiktokshop',
    TikTokShopAdapter,
    DEFAULT_PLATFORM_CONFIGS.tiktokshop
  );
};