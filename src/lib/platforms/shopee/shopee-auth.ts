/**
 * Shopee Authentication Handler
 * Handles OAuth 2.0 authentication flow and token management for Shopee
 */

import crypto from 'crypto';
import { PlatformConfig, ApiResponse } from '../types';
import type { ShopeeCredentials, ShopeeAuthResponse, ShopeeTokenRefreshRequest, ShopeeCommonParams } from './shopee-types';

export class ShopeeAuth {
  private credentials: ShopeeCredentials;
  private config: PlatformConfig;

  constructor(credentials: ShopeeCredentials, config: PlatformConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  /**
   * Generate OAuth authorization URL for Shopee
   */
  generateAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      partner_id: this.credentials.partnerId,
      redirect: redirectUri,
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.config.baseUrl}/api/v2/shop/auth_partner?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticate(authCode?: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string; expiresAt: Date }>> {
    try {
      // If we already have an access token, validate it first
      if (this.credentials.accessToken) {
        const isValid = await this.validateToken();
        if (isValid) {
          return {
            success: true,
            data: {
              accessToken: this.credentials.accessToken,
              refreshToken: this.credentials.refreshToken || '',
              expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours default
            },
          };
        }
      }

      // If we have a refresh token, try to refresh
      if (this.credentials.refreshToken) {
        return this.refreshToken();
      }

      // If we have an auth code, exchange it for tokens
      if (authCode) {
        return this.exchangeAuthCode(authCode);
      }

      return {
        success: false,
        error: {
          code: 'NO_AUTH_METHOD',
          message: 'No authentication method available. Please provide auth code or valid tokens.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: error instanceof Error ? error.message : 'Authentication failed',
        },
      };
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeAuthCode(authCode: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string; expiresAt: Date }>> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v2/auth/token/get';
      
      const baseParams = {
        partner_id: parseInt(this.credentials.partnerId),
        code: authCode,
        shop_id: parseInt(this.credentials.shopId),
        timestamp,
      };

      const sign = this.generateSignature(path, baseParams);
      
      const params = {
        ...baseParams,
        sign,
      };

      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { error?: string; response?: ShopeeAuthResponse } = await response.json();

      if (data.error || !data.response) {
        return {
          success: false,
          error: {
            code: data.error || 'TOKEN_EXCHANGE_FAILED',
            message: 'Failed to exchange authorization code for tokens',
          },
        };
      }

      const authResponse = data.response;
      const expiresAt = new Date(Date.now() + authResponse.expire_in * 1000);

      // Update credentials
      this.credentials.accessToken = authResponse.access_token;
      this.credentials.refreshToken = authResponse.refresh_token;

      return {
        success: true,
        data: {
          accessToken: authResponse.access_token,
          refreshToken: authResponse.refresh_token,
          expiresAt,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOKEN_EXCHANGE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to exchange auth code',
        },
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<ApiResponse<{ accessToken: string; refreshToken: string; expiresAt: Date }>> {
    try {
      if (!this.credentials.refreshToken) {
        return {
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: 'No refresh token available',
          },
        };
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v2/auth/access_token/get';
      
      const baseParams: ShopeeTokenRefreshRequest & { timestamp: number } = {
        partner_id: parseInt(this.credentials.partnerId),
        refresh_token: this.credentials.refreshToken,
        shop_id: parseInt(this.credentials.shopId),
        timestamp,
      };

      const sign = this.generateSignature(path, baseParams);
      
      const params = {
        ...baseParams,
        sign,
      };

      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { error?: string; response?: ShopeeAuthResponse } = await response.json();

      if (data.error || !data.response) {
        return {
          success: false,
          error: {
            code: data.error || 'TOKEN_REFRESH_FAILED',
            message: 'Failed to refresh access token',
          },
        };
      }

      const authResponse = data.response;
      const expiresAt = new Date(Date.now() + authResponse.expire_in * 1000);

      // Update credentials
      this.credentials.accessToken = authResponse.access_token;
      this.credentials.refreshToken = authResponse.refresh_token;

      return {
        success: true,
        data: {
          accessToken: authResponse.access_token,
          refreshToken: authResponse.refresh_token,
          expiresAt,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOKEN_REFRESH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to refresh token',
        },
      };
    }
  }

  /**
   * Validate current access token
   */
  private async validateToken(): Promise<boolean> {
    try {
      if (!this.credentials.accessToken) {
        return false;
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v2/shop/get_shop_info';
      
      const baseParams = {
        partner_id: parseInt(this.credentials.partnerId),
        timestamp,
        access_token: this.credentials.accessToken,
        shop_id: parseInt(this.credentials.shopId),
      };

      const sign = this.generateSignature(path, baseParams);
      
      const params = new URLSearchParams({
        ...baseParams,
        partner_id: baseParams.partner_id.toString(),
        timestamp: baseParams.timestamp.toString(),
        shop_id: baseParams.shop_id.toString(),
        sign,
      });

      const response = await fetch(`${this.config.baseUrl}${path}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate signature for Shopee API requests
   */
  generateSignature(path: string, params: Record<string, any>): string {
    // Sort parameters by key
    const sortedKeys = Object.keys(params).sort();
    
    // Create query string
    const queryString = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Create base string
    const baseString = `${this.credentials.partnerId}${path}${queryString}`;
    
    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', this.credentials.partnerKey)
      .update(baseString)
      .digest('hex');
    
    return signature;
  }

  /**
   * Generate common parameters for API requests
   */
  generateCommonParams(additionalParams: Record<string, any> = {}): ShopeeCommonParams {
    const timestamp = Math.floor(Date.now() / 1000);
    
    const baseParams = {
      partner_id: parseInt(this.credentials.partnerId),
      timestamp,
      ...additionalParams,
    };

    if (this.credentials.accessToken) {
      (baseParams as any).access_token = this.credentials.accessToken;
    }

    if (this.credentials.shopId) {
      (baseParams as any).shop_id = parseInt(this.credentials.shopId);
    }

    return baseParams as ShopeeCommonParams;
  }

  /**
   * Sign API request parameters
   */
  signRequest(path: string, params: Record<string, any>): Record<string, any> {
    const commonParams = this.generateCommonParams(params);
    const sign = this.generateSignature(path, commonParams);
    
    return {
      ...commonParams,
      sign,
    };
  }

  /**
   * Get current credentials
   */
  getCredentials(): ShopeeCredentials {
    return { ...this.credentials };
  }

  /**
   * Update credentials
   */
  updateCredentials(updates: Partial<ShopeeCredentials>): void {
    this.credentials = { ...this.credentials, ...updates };
  }
}