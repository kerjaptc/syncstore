/**
 * Platform Adapter Factory
 * Factory pattern for dynamic platform adapter selection
 */

import { BasePlatformAdapter } from './base-adapter';
import { PlatformCredentials, PlatformConfig } from './types';

// Platform adapter registry
type AdapterConstructor = new (credentials: PlatformCredentials, config: PlatformConfig) => BasePlatformAdapter;

interface PlatformAdapterRegistry {
  [platformName: string]: {
    adapter: AdapterConstructor;
    config: PlatformConfig;
  };
}

export class PlatformAdapterFactory {
  private static registry: PlatformAdapterRegistry = {};

  /**
   * Register a platform adapter
   */
  static registerAdapter(
    platformName: string,
    adapterClass: AdapterConstructor,
    config: PlatformConfig
  ): void {
    this.registry[platformName.toLowerCase()] = {
      adapter: adapterClass,
      config,
    };
  }

  /**
   * Create a platform adapter instance
   */
  static createAdapter(
    platformName: string,
    credentials: PlatformCredentials,
    configOverrides?: Partial<PlatformConfig>
  ): BasePlatformAdapter {
    const normalizedName = platformName.toLowerCase();
    const registration = this.registry[normalizedName];

    if (!registration) {
      throw new Error(`Platform adapter not found: ${platformName}. Available platforms: ${this.getAvailablePlatforms().join(', ')}`);
    }

    // Merge config with overrides
    const config = configOverrides 
      ? { ...registration.config, ...configOverrides }
      : registration.config;

    return new registration.adapter(credentials, config);
  }

  /**
   * Get list of available platforms
   */
  static getAvailablePlatforms(): string[] {
    return Object.keys(this.registry);
  }

  /**
   * Check if platform is supported
   */
  static isPlatformSupported(platformName: string): boolean {
    return this.registry.hasOwnProperty(platformName.toLowerCase());
  }

  /**
   * Get platform configuration
   */
  static getPlatformConfig(platformName: string): PlatformConfig | null {
    const registration = this.registry[platformName.toLowerCase()];
    return registration ? registration.config : null;
  }

  /**
   * Unregister a platform adapter (useful for testing)
   */
  static unregisterAdapter(platformName: string): void {
    delete this.registry[platformName.toLowerCase()];
  }

  /**
   * Clear all registered adapters (useful for testing)
   */
  static clearRegistry(): void {
    this.registry = {};
  }
}

// Default platform configurations
export const DEFAULT_PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  shopee: {
    baseUrl: 'https://partner.shopeemobile.com',
    apiVersion: 'v2',
    rateLimits: {
      requestsPerSecond: 10,
      requestsPerMinute: 600,
      requestsPerHour: 36000,
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
    },
    timeout: 30000,
  },
  tiktokshop: {
    baseUrl: 'https://open-api.tiktokglobalshop.com',
    apiVersion: 'v1',
    rateLimits: {
      requestsPerSecond: 5,
      requestsPerMinute: 300,
      requestsPerHour: 18000,
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
    },
    timeout: 30000,
  },
  lazada: {
    baseUrl: 'https://api.lazada.com/rest',
    apiVersion: 'v1',
    rateLimits: {
      requestsPerSecond: 8,
      requestsPerMinute: 480,
      requestsPerHour: 28800,
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
    },
    timeout: 30000,
  },
  tokopedia: {
    baseUrl: 'https://fs.tokopedia.net',
    apiVersion: 'v1',
    rateLimits: {
      requestsPerSecond: 12,
      requestsPerMinute: 720,
      requestsPerHour: 43200,
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
    },
    timeout: 30000,
  },
};