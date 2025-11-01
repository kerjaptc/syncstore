import crypto from 'crypto';

export interface ShopeeOAuthConfig {
  partnerId: string;
  partnerKey: string;
  host: string;
  redirectUrl: string;
  env: 'sandbox' | 'production';
}

export interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  shop_id: number;
}

export class ShopeeOAuth {
  private config: ShopeeOAuthConfig;

  constructor(config: ShopeeOAuthConfig) {
    this.config = config;
  }

  /**
   * Generate HMAC-SHA256 signature for Shopee API
   */
  private generateSignature(baseString: string): string {
    return crypto
      .createHmac('sha256', this.config.partnerKey)
      .update(baseString)
      .digest('hex');
  }

  /**
   * Get current UNIX timestamp in seconds
   */
  private getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(): { url: string; timestamp: number } {
    const timestamp = this.getTimestamp();
    const path = '/api/v2/shop/auth_partner';
    const baseString = `${this.config.partnerId}${path}${timestamp}`;
    const sign = this.generateSignature(baseString);

    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: timestamp.toString(),
      redirect: this.config.redirectUrl,
      sign: sign,
    });

    const url = `https://${this.config.host}${path}?${params.toString()}`;
    
    return { url, timestamp };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeToken(code: string, shopId: string): Promise<ShopeeTokenResponse> {
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

    const response = await fetch(`https://${this.config.host}${path}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Shopee API error: ${data.error} - ${data.message}`);
    }

    return data;
  }

  /**
   * Make authenticated API call to Shopee
   */
  async makeApiCall(
    path: string,
    accessToken: string,
    shopId: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<any> {
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

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Shopee API error: ${data.error} - ${data.message}`);
    }

    return data;
  }

  /**
   * Get shop information
   */
  async getShopInfo(accessToken: string, shopId: string): Promise<any> {
    return this.makeApiCall('/api/v2/shop/get_shop_info', accessToken, shopId);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, shopId: string): Promise<ShopeeTokenResponse> {
    const timestamp = this.getTimestamp();
    const path = '/api/v2/auth/access_token/get';
    const baseString = `${this.config.partnerId}${path}${timestamp}${shopId}`;
    const sign = this.generateSignature(baseString);

    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: timestamp.toString(),
      shop_id: shopId,
      sign: sign,
    });

    const body = {
      refresh_token: refreshToken,
      shop_id: parseInt(shopId),
    };

    const response = await fetch(`https://${this.config.host}${path}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Shopee API error: ${data.error} - ${data.message}`);
    }

    return data;
  }
}

/**
 * Create ShopeeOAuth instance from environment variables
 */
export function createShopeeOAuth(): ShopeeOAuth {
  const config: ShopeeOAuthConfig = {
    partnerId: process.env.SHOPEE_PARTNER_ID!,
    partnerKey: process.env.SHOPEE_PARTNER_KEY!,
    host: process.env.SHOPEE_HOST!,
    redirectUrl: process.env.SHOPEE_REDIRECT_URL!,
    env: (process.env.SHOPEE_ENV as 'sandbox' | 'production') || 'sandbox',
  };

  // Validate required config
  if (!config.partnerId || !config.partnerKey || !config.host || !config.redirectUrl) {
    throw new Error('Missing required Shopee OAuth configuration');
  }

  return new ShopeeOAuth(config);
}