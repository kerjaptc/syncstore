/**
 * Base Platform Adapter
 * Abstract base class defining common marketplace operations
 */

import {
  PlatformCredentials,
  PlatformConfig,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  PlatformProduct,
  PlatformOrder,
  WebhookPayload,
  PlatformError,
  PlatformErrorType,
  RateLimitInfo,
  RequestContext
} from './types';

export abstract class BasePlatformAdapter {
  protected credentials: PlatformCredentials;
  protected config: PlatformConfig;
  protected rateLimitInfo: RateLimitInfo | null = null;

  constructor(credentials: PlatformCredentials, config: PlatformConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  // Abstract methods that must be implemented by platform-specific adapters
  abstract getPlatformName(): string;
  abstract authenticate(): Promise<ApiResponse<{ accessToken: string; expiresAt: Date }>>;
  abstract refreshToken(): Promise<ApiResponse<{ accessToken: string; expiresAt: Date }>>;
  abstract validateCredentials(): Promise<ApiResponse<boolean>>;

  // Product operations
  abstract getProducts(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<PlatformProduct>>>;
  abstract getProduct(productId: string): Promise<ApiResponse<PlatformProduct>>;
  abstract createProduct(product: Partial<PlatformProduct>): Promise<ApiResponse<PlatformProduct>>;
  abstract updateProduct(productId: string, updates: Partial<PlatformProduct>): Promise<ApiResponse<PlatformProduct>>;
  abstract deleteProduct(productId: string): Promise<ApiResponse<void>>;
  abstract updateInventory(productId: string, variantId: string, quantity: number): Promise<ApiResponse<void>>;

  // Order operations
  abstract getOrders(params?: PaginationParams & { status?: string; startDate?: Date; endDate?: Date }): Promise<ApiResponse<PaginatedResponse<PlatformOrder>>>;
  abstract getOrder(orderId: string): Promise<ApiResponse<PlatformOrder>>;
  abstract updateOrderStatus(orderId: string, status: string, trackingInfo?: { carrier?: string; trackingNumber?: string }): Promise<ApiResponse<void>>;
  abstract cancelOrder(orderId: string, reason?: string): Promise<ApiResponse<void>>;

  // Webhook operations
  abstract validateWebhook(payload: string, signature: string): boolean;
  abstract processWebhook(payload: WebhookPayload): Promise<ApiResponse<void>>;

  // Common utility methods
  protected async makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      data?: any;
      headers?: Record<string, string>;
      retryCount?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const context: RequestContext = {
      requestId: this.generateRequestId(),
      timestamp: new Date(),
      endpoint,
      method: options.method || 'GET',
      retryCount: options.retryCount || 0,
    };

    try {
      // Check rate limits
      await this.checkRateLimit();

      // Prepare request
      const url = `${this.config.baseUrl}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'StoreSync/1.0',
        ...this.getAuthHeaders(),
        ...options.headers,
      };

      // Make request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.data ? JSON.stringify(options.data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Update rate limit info from response headers
      this.updateRateLimitInfo(response);

      // Handle response
      if (!response.ok) {
        return this.handleErrorResponse(response, context);
      }

      const data = await response.json();
      
      return {
        success: true,
        data,
        metadata: {
          requestId: context.requestId,
          timestamp: context.timestamp,
          rateLimitRemaining: this.rateLimitInfo?.remaining,
          rateLimitReset: this.rateLimitInfo?.reset,
        },
      };

    } catch (error) {
      return this.handleRequestError(error, context, options);
    }
  }

  protected abstract getAuthHeaders(): Record<string, string>;

  protected async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return;

    if (this.rateLimitInfo.remaining <= 0) {
      const waitTime = this.rateLimitInfo.reset.getTime() - Date.now();
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }
  }

  protected updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('x-rate-limit-remaining');
    const reset = response.headers.get('x-rate-limit-reset');
    const limit = response.headers.get('x-rate-limit-limit');

    if (remaining && reset && limit) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining, 10),
        reset: new Date(parseInt(reset, 10) * 1000),
        limit: parseInt(limit, 10),
      };
    }
  }

  protected async handleErrorResponse<T>(
    response: Response,
    context: RequestContext
  ): Promise<ApiResponse<T>> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const errorType = this.classifyError(response.status, errorData);
    
    // Handle retryable errors
    if (this.isRetryableError(errorType) && context.retryCount < this.config.retryConfig.maxRetries) {
      const delay = this.calculateRetryDelay(context.retryCount);
      await this.delay(delay);
      
      return this.makeRequest(context.endpoint, {
        method: context.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        retryCount: context.retryCount + 1,
      });
    }

    return {
      success: false,
      error: {
        code: errorData.code || response.status.toString(),
        message: errorData.message || response.statusText,
        details: errorData,
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
      },
    };
  }

  protected async handleRequestError<T>(
    error: any,
    context: RequestContext,
    options: any
  ): Promise<ApiResponse<T>> {
    let errorType = PlatformErrorType.UNKNOWN;
    let message = 'Unknown error occurred';

    if (error.name === 'AbortError') {
      errorType = PlatformErrorType.TIMEOUT;
      message = 'Request timeout';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorType = PlatformErrorType.NETWORK;
      message = 'Network error';
    }

    // Handle retryable errors
    if (this.isRetryableError(errorType) && context.retryCount < this.config.retryConfig.maxRetries) {
      const delay = this.calculateRetryDelay(context.retryCount);
      await this.delay(delay);
      
      return this.makeRequest(context.endpoint, {
        ...options,
        retryCount: context.retryCount + 1,
      });
    }

    return {
      success: false,
      error: {
        code: errorType,
        message,
        details: error,
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
      },
    };
  }

  protected classifyError(statusCode: number, errorData: any): PlatformErrorType {
    switch (statusCode) {
      case 401:
        return PlatformErrorType.AUTHENTICATION;
      case 403:
        return PlatformErrorType.AUTHORIZATION;
      case 404:
        return PlatformErrorType.NOT_FOUND;
      case 422:
        return PlatformErrorType.VALIDATION;
      case 429:
        return PlatformErrorType.RATE_LIMIT;
      case 500:
      case 502:
      case 503:
      case 504:
        return PlatformErrorType.SERVER_ERROR;
      default:
        return PlatformErrorType.UNKNOWN;
    }
  }

  protected isRetryableError(errorType: PlatformErrorType): boolean {
    return [
      PlatformErrorType.RATE_LIMIT,
      PlatformErrorType.NETWORK,
      PlatformErrorType.TIMEOUT,
      PlatformErrorType.SERVER_ERROR,
    ].includes(errorType);
  }

  protected calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryConfig.baseDelay;
    const maxDelay = this.config.retryConfig.maxDelay;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
    const masked = { ...data };

    for (const key in masked) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        masked[key] = '***MASKED***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }

    return masked;
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: 'healthy' | 'unhealthy'; details: any }>> {
    try {
      const authResult = await this.validateCredentials();
      
      return {
        success: true,
        data: {
          status: authResult.success ? 'healthy' : 'unhealthy',
          details: {
            platform: this.getPlatformName(),
            authenticated: authResult.success,
            rateLimitInfo: this.rateLimitInfo,
            timestamp: new Date(),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {
          status: 'unhealthy',
          details: {
            platform: this.getPlatformName(),
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          },
        },
      };
    }
  }
}