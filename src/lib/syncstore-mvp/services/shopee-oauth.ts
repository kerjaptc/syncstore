/**
 * SyncStore MVP Shopee OAuth Service
 * 
 * This service handles Shopee OAuth flow with proper error handling,
 * state management, and security validation.
 */

import crypto from 'crypto';
import { z } from 'zod';
import {
  ShopeeIntegrationService,
  AuthUrl,
  StoreConnection,
  ConnectionStatus,
  ShopeeOAuthCredentials,
  ShopeeApiError,
  ConnectionError,
  ValidationError,
  createErrorContext,
  retryWithBackoff,
  validateData,
  ShopeeOAuthCredentialsSchema,
} from '../index';

// ============================================================================
// Configuration and Types
// ============================================================================

export interface ShopeeOAuthConfig {
  partnerId: string;
  partnerKey: string;
  host: string;
  redirectUrl: string;
  env: 'sandbox' | 'production';
}

const ShopeeOAuthConfigSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  partnerKey: z.string().min(1, 'Partner Key is required'),
  host: z.string().min(1, 'Host is required'),
  redirectUrl: z.string().url('Invalid redirect URL'),
  env: z.enum(['sandbox', 'production']),
});

interface ShopeeApiResponse<T> {
  error: string;
  message: string;
  response: T;
}

interface ShopeeShopInfo {
  shop_id: number;
  shop_name: string;
  region: string;
  status: string;
}

// ============================================================================
// OAuth State Management
// ============================================================================

interface OAuthState {
  organizationId: string;
  timestamp: number;
  nonce: string;
}

class OAuthStateManager {
  private states = new Map<string, OAuthState>();
  private readonly STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

  generateState(organizationId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const stateId = crypto.randomBytes(32).toString('hex');
    
    this.states.set(stateId, {
      organizationId,
      timestamp,
      nonce,
    });
    
    // Clean up expired states
    this.cleanupExpiredStates();
    
    return stateId;
  }

  validateState(stateId: string): OAuthState | null {
    const state = this.states.get(stateId);
    if (!state) {
      return null;
    }
    
    // Check if state is expired
    if (Date.now() - state.timestamp > this.STATE_EXPIRY) {
      this.states.delete(stateId);
      return null;
    }
    
    // Remove state after validation (one-time use)
    this.states.delete(stateId);
    return state;
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [stateId, state] of this.states.entries()) {
      if (now - state.timestamp > this.STATE_EXPIRY) {
        this.states.delete(stateId);
      }
    }
  }
}

// ============================================================================
// Shopee OAuth Service Implementation
// ============================================================================

export class ShopeeOAuthService implements Partial<ShopeeIntegrationService> {
  private config: ShopeeOAuthConfig;
  private stateManager = new OAuthStateManager();
  
  constructor(config: ShopeeOAuthConfig) {
    this.config = validateData(ShopeeOAuthConfigSchema, config, 'ShopeeOAuthConfig');
  }

  // ============================================================================
  // OAuth Flow Methods
  // ============================================================================

  /**
   * Initiates OAuth flow by generating authorization URL
   */
  async initiateOAuth(organizationId: string): Promise<AuthUrl> {
    try {
      if (!organizationId) {
        throw new ValidationError('Organization ID is required', 'organizationId');
      }

      const state = this.stateManager.generateState(organizationId);
      const timestamp = this.getTimestamp();
      const path = '/api/v2/shop/auth_partner';
      const baseString = `${this.config.partnerId}${path}${timestamp}`;
      const sign = this.generateSignature(baseString);

      const params = new URLSearchParams({
        partner_id: this.config.partnerId,
        timestamp: timestamp.toString(),
        redirect: this.config.redirectUrl,
        sign: sign,
        state: state, // Add state parameter for security
      });

      const url = `https://${this.config.host}${path}?${params.toString()}`;
      
      return { url, state };
    } catch (error) {
      const context = createErrorContext('initiateOAuth', { organizationId });
      throw new ConnectionError(
        `Failed to initiate OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unknown',
        'shopee',
        context
      );
    }
  }

  /**
   * Handles OAuth callback and exchanges code for tokens
   */
  async handleOAuthCallback(code: string, state: string): Promise<StoreConnection> {
    try {
      // Validate input
      if (!code) {
        throw new ValidationError('Authorization code is required', 'code');
      }
      if (!state) {
        throw new ValidationError('State parameter is required', 'state');
      }

      // Validate state
      const oauthState = this.stateManager.validateState(state);
      if (!oauthState) {
        throw new ValidationError('Invalid or expired state parameter', 'state');
      }

      // Extract shop_id from code (Shopee includes it in the callback)
      const urlParams = new URLSearchParams(code);
      const shopId = urlParams.get('shop_id');
      if (!shopId) {
        throw new ValidationError('Shop ID not found in callback', 'shop_id');
      }

      // Exchange code for tokens with retry logic
      const tokenResponse = await retryWithBackoff(
        () => this.exchangeTokens(code, shopId),
        3,
        1000
      );

      // Get shop information
      const shopInfo = await retryWithBackoff(
        () => this.getShopInfo(tokenResponse.access_token, shopId),
        3,
        1000
      );

      // Create store connection
      const connection: Omit<StoreConnection, 'id' | 'createdAt' | 'updatedAt'> = {
        organizationId: oauthState.organizationId,
        platform: 'shopee',
        storeId: shopId,
        storeName: shopInfo.shop_name,
        credentials: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt: new Date(Date.now() + tokenResponse.expire_in * 1000),
        },
        status: 'active',
        lastSyncAt: undefined,
      };

      // Note: In a real implementation, this would be saved to database
      // For now, we'll return the connection object with a generated ID
      return {
        ...connection,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

    } catch (error) {
      const context = createErrorContext('handleOAuthCallback', { code: '[REDACTED]', state });
      
      if (error instanceof ValidationError || error instanceof ShopeeApiError) {
        throw error;
      }
      
      throw new ConnectionError(
        `OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unknown',
        'shopee',
        context
      );
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  async refreshAccessToken(storeId: string): Promise<void> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      // Note: In a real implementation, this would fetch the connection from database
      // For now, we'll throw an error indicating this needs to be implemented
      throw new Error('refreshAccessToken requires database integration - to be implemented in next task');

    } catch (error) {
      const context = createErrorContext('refreshAccessToken', { storeId });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ConnectionError(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        'shopee',
        context
      );
    }
  }

  /**
   * Validates store connection by making a test API call
   */
  async validateConnection(storeId: string): Promise<ConnectionStatus> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      // Note: In a real implementation, this would fetch the connection from database
      // and make a test API call. For now, we'll return a placeholder response.
      throw new Error('validateConnection requires database integration - to be implemented in next task');

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date(),
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generates HMAC-SHA256 signature for Shopee API
   */
  private generateSignature(baseString: string): string {
    return crypto
      .createHmac('sha256', this.config.partnerKey)
      .update(baseString)
      .digest('hex');
  }

  /**
   * Gets current UNIX timestamp in seconds
   */
  private getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Exchanges authorization code for access tokens
   */
  private async exchangeTokens(code: string, shopId: string): Promise<ShopeeOAuthCredentials> {
    const timestamp = this.getTimestamp();
    const path = '/api/v2/auth/token/get';
    const baseString = `${this.config.partnerId}${path}${timestamp}${shopId}`;
    const sign = this.generateSignature(baseString);

    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: timestamp.toString(),
      sign: sign,
    });

    const body = {
      code,
      shop_id: parseInt(shopId),
    };

    try {
      const response = await fetch(`https://${this.config.host}${path}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ShopeeApiError(
          `Token exchange failed: ${errorText}`,
          'TOKEN_EXCHANGE_FAILED',
          response.status,
          undefined,
          { shopId, httpStatus: response.status }
        );
      }

      const data: ShopeeApiResponse<ShopeeOAuthCredentials> = await response.json();
      
      if (data.error && data.error !== '') {
        throw new ShopeeApiError(
          `Shopee API error: ${data.message}`,
          data.error,
          undefined,
          undefined,
          { shopId }
        );
      }

      // Validate response data
      return validateData(ShopeeOAuthCredentialsSchema, data.response, 'ShopeeOAuthCredentials');

    } catch (error) {
      if (error instanceof ShopeeApiError) {
        throw error;
      }
      
      throw new ShopeeApiError(
        `Network error during token exchange: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        undefined,
        undefined,
        { shopId }
      );
    }
  }

  /**
   * Gets shop information from Shopee API
   */
  private async getShopInfo(accessToken: string, shopId: string): Promise<ShopeeShopInfo> {
    const timestamp = this.getTimestamp();
    const path = '/api/v2/shop/get_shop_info';
    const baseString = `${this.config.partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = this.generateSignature(baseString);

    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: timestamp.toString(),
      access_token: accessToken,
      shop_id: shopId,
      sign: sign,
    });

    try {
      const response = await fetch(`https://${this.config.host}${path}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ShopeeApiError(
          `Shop info request failed: ${errorText}`,
          'SHOP_INFO_FAILED',
          response.status,
          undefined,
          { shopId, httpStatus: response.status }
        );
      }

      const data: ShopeeApiResponse<ShopeeShopInfo> = await response.json();
      
      if (data.error && data.error !== '') {
        throw new ShopeeApiError(
          `Shopee API error: ${data.message}`,
          data.error,
          undefined,
          undefined,
          { shopId }
        );
      }

      return data.response;

    } catch (error) {
      if (error instanceof ShopeeApiError) {
        throw error;
      }
      
      throw new ShopeeApiError(
        `Network error during shop info request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        undefined,
        undefined,
        { shopId }
      );
    }
  }

  /**
   * Makes authenticated API call to Shopee (for future use)
   */
  private async makeAuthenticatedApiCall<T>(
    path: string,
    accessToken: string,
    shopId: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const timestamp = this.getTimestamp();
    const baseString = `${this.config.partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = this.generateSignature(baseString);

    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: timestamp.toString(),
      access_token: accessToken,
      shop_id: shopId,
      sign: sign,
    });

    const url = `https://${this.config.host}${path}?${params.toString()}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new ShopeeApiError(
          `API call failed: ${errorText}`,
          'API_CALL_FAILED',
          response.status,
          response.status === 429 ? 60 : undefined, // Default retry after for rate limiting
          { path, method, shopId, httpStatus: response.status }
        );
      }

      const data: ShopeeApiResponse<T> = await response.json();
      
      if (data.error && data.error !== '') {
        throw new ShopeeApiError(
          `Shopee API error: ${data.message}`,
          data.error,
          undefined,
          undefined,
          { path, method, shopId }
        );
      }

      return data.response;

    } catch (error) {
      if (error instanceof ShopeeApiError) {
        throw error;
      }
      
      throw new ShopeeApiError(
        `Network error during API call: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        undefined,
        undefined,
        { path, method, shopId }
      );
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates ShopeeOAuthService instance from environment variables
 */
export function createShopeeOAuthService(): ShopeeOAuthService {
  const config: ShopeeOAuthConfig = {
    partnerId: process.env.SHOPEE_PARTNER_ID || '',
    partnerKey: process.env.SHOPEE_PARTNER_KEY || '',
    host: process.env.SHOPEE_HOST || 'partner.test-stable.shopeemobile.com',
    redirectUrl: process.env.SHOPEE_REDIRECT_URL || '',
    env: (process.env.SHOPEE_ENV as 'sandbox' | 'production') || 'sandbox',
  };

  return new ShopeeOAuthService(config);
}

/**
 * Validates Shopee OAuth configuration
 */
export function validateShopeeOAuthConfig(config: Partial<ShopeeOAuthConfig>): string[] {
  const result = ShopeeOAuthConfigSchema.safeParse(config);
  if (result.success) {
    return [];
  }
  
  return result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
}