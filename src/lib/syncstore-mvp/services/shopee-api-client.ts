/**
 * SyncStore MVP Shopee API Client
 * 
 * This service provides a robust HTTP client for Shopee API with proper
 * authentication, rate limiting, error handling, and request/response logging.
 */

import crypto from 'crypto';
import {
  ShopeeApiError,
  ValidationError,
  createErrorContext,
  retryWithBackoff,
  CircuitBreaker,
  validateData,
} from '../index';
import { z } from 'zod';

// ============================================================================
// Configuration and Types
// ============================================================================

export interface ShopeeApiConfig {
  partnerId: string;
  partnerKey: string;
  host: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimitDelay: number;
}

export interface ApiCallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  accessToken?: string;
  shopId?: string;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T> {
  data: T;
  requestId: string;
  timestamp: Date;
  responseTime: number;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface ApiCallLog {
  requestId: string;
  method: string;
  path: string;
  shopId?: string;
  timestamp: Date;
  responseTime: number;
  statusCode: number;
  success: boolean;
  error?: string;
  rateLimited: boolean;
}

// Validation schemas
const ShopeeApiConfigSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  partnerKey: z.string().min(1, 'Partner Key is required'),
  host: z.string().min(1, 'Host is required'),
  timeout: z.number().min(1000).max(300000), // 1s to 5min
  retryAttempts: z.number().min(0).max(10),
  retryDelay: z.number().min(100).max(60000),
  rateLimitDelay: z.number().min(100).max(10000),
});

const ApiCallOptionsSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  path: z.string().min(1, 'API path is required'),
  accessToken: z.string().optional(),
  shopId: z.string().optional(),
  body: z.any().optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  retries: z.number().min(0).max(10).optional(),
});

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowSize = 60000; // 1 minute
  private readonly maxRequests = 1000; // Shopee's typical rate limit

  /**
   * Checks if request is allowed under rate limit
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowSize);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  /**
   * Gets remaining requests in current window
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => now - time < this.windowSize);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Gets time until rate limit resets
   */
  getResetTime(key: string): Date {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    if (requests.length === 0) {
      return new Date(now);
    }
    
    const oldestRequest = Math.min(...requests);
    return new Date(oldestRequest + this.windowSize);
  }

  /**
   * Cleans up old rate limit data
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < this.windowSize);
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

// ============================================================================
// Request Queue Manager
// ============================================================================

interface QueuedRequest {
  id: string;
  options: ApiCallOptions;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timestamp: Date;
  retryCount: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private rateLimiter: RateLimiter;
  private config: ShopeeApiConfig;

  constructor(rateLimiter: RateLimiter, config: ShopeeApiConfig) {
    this.rateLimiter = rateLimiter;
    this.config = config;
  }

  /**
   * Adds request to queue
   */
  async enqueue<T>(options: ApiCallOptions): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: crypto.randomUUID(),
        options,
        resolve,
        reject,
        timestamp: new Date(),
        retryCount: 0,
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  /**
   * Processes queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      const rateLimitKey = request.options.shopId || 'global';

      // Check rate limit
      if (!this.rateLimiter.isAllowed(rateLimitKey)) {
        // Re-queue the request
        this.queue.unshift(request);
        
        // Wait for rate limit to reset
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
        continue;
      }

      try {
        // Process the request (this would be implemented by the API client)
        // For now, we'll just resolve with a placeholder
        request.resolve({ success: true });
      } catch (error) {
        request.reject(error as Error);
      }
    }

    this.processing = false;
  }

  /**
   * Gets queue status
   */
  getStatus(): { queueLength: number; processing: boolean } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }

  /**
   * Clears the queue
   */
  clear(): void {
    // Reject all pending requests
    for (const request of this.queue) {
      request.reject(new Error('Request queue cleared'));
    }
    this.queue = [];
    this.processing = false;
  }
}

// ============================================================================
// Shopee API Client
// ============================================================================

export class ShopeeApiClient {
  private config: ShopeeApiConfig;
  private rateLimiter: RateLimiter;
  private requestQueue: RequestQueue;
  private circuitBreaker: CircuitBreaker;
  private callLogs: ApiCallLog[] = [];
  private readonly maxLogEntries = 1000;

  constructor(config: ShopeeApiConfig) {
    this.config = validateData(ShopeeApiConfigSchema, config, 'ShopeeApiConfig');
    this.rateLimiter = new RateLimiter();
    this.requestQueue = new RequestQueue(this.rateLimiter, this.config);
    this.circuitBreaker = new CircuitBreaker(5, 60000, 2);
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Makes an authenticated API call to Shopee
   */
  async makeApiCall<T>(options: ApiCallOptions): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    try {
      // Validate options
      const validatedOptions = validateData(ApiCallOptionsSchema, options, 'ApiCallOptions');
      
      // Use circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        return await this.executeApiCall<T>(validatedOptions, requestId, startTime);
      });

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log failed call
      this.logApiCall({
        requestId,
        method: options.method,
        path: options.path,
        shopId: options.shopId,
        timestamp: new Date(),
        responseTime,
        statusCode: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        rateLimited: error instanceof ShopeeApiError && error.isRateLimited,
      });

      throw error;
    }
  }

  /**
   * Makes a GET request
   */
  async get<T>(path: string, accessToken?: string, shopId?: string): Promise<ApiResponse<T>> {
    return this.makeApiCall<T>({
      method: 'GET',
      path,
      accessToken,
      shopId,
    });
  }

  /**
   * Makes a POST request
   */
  async post<T>(
    path: string,
    body: any,
    accessToken?: string,
    shopId?: string
  ): Promise<ApiResponse<T>> {
    return this.makeApiCall<T>({
      method: 'POST',
      path,
      body,
      accessToken,
      shopId,
    });
  }

  /**
   * Gets rate limit information
   */
  getRateLimitInfo(shopId?: string): RateLimitInfo {
    const key = shopId || 'global';
    
    return {
      remaining: this.rateLimiter.getRemaining(key),
      resetTime: this.rateLimiter.getResetTime(key),
    };
  }

  /**
   * Gets API call logs
   */
  getApiLogs(limit?: number): ApiCallLog[] {
    const logs = [...this.callLogs].reverse(); // Most recent first
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Gets API client statistics
   */
  getStatistics(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
    rateLimitedCalls: number;
    circuitBreakerStatus: any;
    queueStatus: any;
  } {
    const totalCalls = this.callLogs.length;
    const successfulCalls = this.callLogs.filter(log => log.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const rateLimitedCalls = this.callLogs.filter(log => log.rateLimited).length;
    
    const totalResponseTime = this.callLogs.reduce((sum, log) => sum + log.responseTime, 0);
    const averageResponseTime = totalCalls > 0 ? totalResponseTime / totalCalls : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageResponseTime,
      rateLimitedCalls,
      circuitBreakerStatus: this.circuitBreaker.status,
      queueStatus: this.requestQueue.getStatus(),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Executes the actual API call
   */
  private async executeApiCall<T>(
    options: ApiCallOptions,
    requestId: string,
    startTime: number
  ): Promise<ApiResponse<T>> {
    const { method, path, accessToken, shopId, body, timeout } = options;
    
    // Generate signature and build URL
    const timestamp = this.getTimestamp();
    const url = this.buildApiUrl(path, accessToken, shopId, timestamp);
    
    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SyncStore-MVP/1.0',
        'X-Request-ID': requestId,
      },
      signal: AbortSignal.timeout(timeout || this.config.timeout),
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(body);
    }

    // Make the request with retry logic
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, requestOptions);
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new ShopeeApiError(
            `HTTP ${res.status}: ${errorText}`,
            'HTTP_ERROR',
            res.status,
            this.extractRetryAfter(res),
            { path, method, shopId }
          );
        }
        
        return res;
      },
      options.retries || this.config.retryAttempts,
      this.config.retryDelay
    );

    // Parse response
    const responseData = await response.json();
    const responseTime = Date.now() - startTime;

    // Check for API errors
    if (responseData.error && responseData.error !== '') {
      throw new ShopeeApiError(
        `Shopee API error: ${responseData.message}`,
        responseData.error,
        response.status,
        this.extractRetryAfter(response),
        { path, method, shopId }
      );
    }

    // Log successful call
    this.logApiCall({
      requestId,
      method,
      path,
      shopId,
      timestamp: new Date(),
      responseTime,
      statusCode: response.status,
      success: true,
      rateLimited: false,
    });

    return {
      data: responseData.response || responseData,
      requestId,
      timestamp: new Date(),
      responseTime,
    };
  }

  /**
   * Builds the complete API URL with signature
   */
  private buildApiUrl(
    path: string,
    accessToken?: string,
    shopId?: string,
    timestamp?: number
  ): string {
    const ts = timestamp || this.getTimestamp();
    const baseString = this.buildSignatureBaseString(path, accessToken, shopId, ts);
    const signature = this.generateSignature(baseString);

    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: ts.toString(),
      sign: signature,
    });

    if (accessToken) {
      params.set('access_token', accessToken);
    }

    if (shopId) {
      params.set('shop_id', shopId);
    }

    return `https://${this.config.host}${path}?${params.toString()}`;
  }

  /**
   * Builds the base string for signature generation
   */
  private buildSignatureBaseString(
    path: string,
    accessToken?: string,
    shopId?: string,
    timestamp?: number
  ): string {
    const ts = timestamp || this.getTimestamp();
    let baseString = `${this.config.partnerId}${path}${ts}`;
    
    if (accessToken) {
      baseString += accessToken;
    }
    
    if (shopId) {
      baseString += shopId;
    }
    
    return baseString;
  }

  /**
   * Generates HMAC-SHA256 signature
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
   * Extracts retry-after header from response
   */
  private extractRetryAfter(response: Response): number | undefined {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? undefined : seconds;
    }
    return undefined;
  }

  /**
   * Logs API call for monitoring and debugging
   */
  private logApiCall(log: ApiCallLog): void {
    this.callLogs.push(log);
    
    // Keep only the most recent logs
    if (this.callLogs.length > this.maxLogEntries) {
      this.callLogs = this.callLogs.slice(-this.maxLogEntries);
    }
  }

  /**
   * Cleans up resources
   */
  cleanup(): void {
    this.requestQueue.clear();
    this.rateLimiter.cleanup();
    this.callLogs = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates ShopeeApiClient from environment variables
 */
export function createShopeeApiClient(): ShopeeApiClient {
  const config: ShopeeApiConfig = {
    partnerId: process.env.SHOPEE_PARTNER_ID || '',
    partnerKey: process.env.SHOPEE_PARTNER_KEY || '',
    host: process.env.SHOPEE_HOST || 'partner.test-stable.shopeemobile.com',
    timeout: parseInt(process.env.SHOPEE_API_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(process.env.SHOPEE_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.SHOPEE_RETRY_DELAY || '1000', 10),
    rateLimitDelay: parseInt(process.env.SHOPEE_RATE_LIMIT_DELAY || '1000', 10),
  };

  return new ShopeeApiClient(config);
}

/**
 * Validates Shopee API client configuration
 */
export function validateShopeeApiConfig(config: Partial<ShopeeApiConfig>): string[] {
  const result = ShopeeApiConfigSchema.safeParse(config);
  if (result.success) {
    return [];
  }
  
  return result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
}