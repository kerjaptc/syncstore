/**
 * TikTok Shop Authentication Handler
 * Handles OAuth authentication flow and token management for TikTok Shop
 */

import crypto from 'crypto';
import { PlatformConfig, ApiResponse } from '../types';
import type { TikTokShopCredentials, TikTokShopAuthResponse, TikTokShopTokenRefreshRequest } from './tiktokshop-types';

export class TikTokShopAuth {
  private credentials: TikTokShopCredentials;
  private config: PlatformConfig;

  constructor(credentials: TikTokShopCredentials, config: PlatformConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  /**
   * Generate OAuth authorization URL for TikTok Shop
   */
  generateAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      app_key: this.credentials.appKey,
      state: state || this.generateState(),
      redirect_uri: redirectUri,
      response_type: 'code',
    });

    return `${this.config.baseUrl}/oauth/authorize?${params.toString()}`;
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
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
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
      const requestData = {
        app_key: this.credentials.appKey,
        app_secret: this.credentials.appSecret,
        auth_code: authCode,
        grant_type: 'authorized_code',
      };

      const response = await fetch(`${this.config.baseUrl}/api/token/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { code: number; message: string; data?: TikTokShopAuthResponse } = await response.json();

      if (data.code !== 0 || !data.data) {
        return {
          success: false,
          error: {
            code: data.code.toString(),
            message: data.message || 'Failed to exchange authorization code for tokens',
          },
        };
      }

      const authResponse = data.data;
      const expiresAt = new Date(Date.now() + authResponse.access_token_expire_in * 1000);

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

      const requestData: TikTokShopTokenRefreshRequest = {
        app_key: this.credentials.appKey,
        app_secret: this.credentials.appSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      };

      const response = await fetch(`${this.config.baseUrl}/api/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { code: number; message: string; data?: TikTokShopAuthResponse } = await response.json();

      if (data.code !== 0 || !data.data) {
        return {
          success: false,
          error: {
            code: data.code.toString(),
            message: data.message || 'Failed to refresh access token',
          },
        };
      }

      const authResponse = data.data;
      const expiresAt = new Date(Date.now() + authResponse.access_token_expire_in * 1000);

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
      const path = '/api/shop/get_authorized_shop';
      const params = {
        app_key: this.credentials.appKey,
        timestamp: timestamp.toString(),
        access_token: this.credentials.accessToken,
      };

      const sign = this.generateSignature(path, params);
      const queryParams = new URLSearchParams({
        ...params,
        sign,
      });

      const response = await fetch(`${this.config.baseUrl}${path}?${queryParams.toString()}`, {
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
   * Generate signature for TikTok Shop API requests
   */
  generateSignature(path: string, params: Record<string, string>): string {
    // Sort parameters by key
    const sortedKeys = Object.keys(params).sort();
    
    // Create query string
    const queryString = sortedKeys
      .map(key => `${key}${params[key]}`)
      .join('');
    
    // Create base string
    const baseString = `${path}${queryString}`;
    
    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', this.credentials.appSecret)
      .update(baseString)
      .digest('hex');
    
    return signature;
  }

  /**
   * Generate common parameters for API requests
   */
  generateCommonParams(additionalParams: Record<string, string> = {}): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    
    const baseParams: Record<string, string> = {
      app_key: this.credentials.appKey,
      timestamp: timestamp.toString(),
      ...additionalParams,
    };

    if (this.credentials.accessToken) {
      baseParams.access_token = this.credentials.accessToken;
    }

    return baseParams;
  }

  /**
   * Sign API request parameters
   */
  signRequest(path: string, params: Record<string, string> = {}): Record<string, string> {
    const commonParams = this.generateCommonParams(params);
    const sign = this.generateSignature(path, commonParams);
    
    return {
      ...commonParams,
      sign,
    };
  }

  /**
   * Generate random state for OAuth flow
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get current credentials
   */
  getCredentials(): TikTokShopCredentials {
    return { ...this.credentials };
  }

  /**
   * Update credentials
   */
  updateCredentials(updates: Partial<TikTokShopCredentials>): void {
    this.credentials = { ...this.credentials, ...updates };
  }

  /**
   * Get authorization scopes
   */
  getRequiredScopes(): string[] {
    return [
      'user.info.basic',
      'product.list',
      'product.detail',
      'product.edit',
      'order.list',
      'order.detail',
      'order.fulfill',
      'fulfillment.detail',
      'inventory.read',
      'inventory.write',
    ];
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    try {
      // TikTok Shop webhook signature validation
      const baseString = `${timestamp}${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.credentials.appSecret)
        .update(baseString)
        .digest('hex');

      // Compare signatures using timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Webhook signature validation error:', error);
      return false;
    }
  }
}