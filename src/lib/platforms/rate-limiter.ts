/**
 * Rate Limiter and Request Queue
 * Manages API rate limits and request queuing
 */

interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
}

interface QueuedRequest {
  id: string;
  platformName: string;
  priority: number;
  timestamp: Date;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface RateLimitState {
  secondWindow: { count: number; resetTime: number };
  minuteWindow: { count: number; resetTime: number };
  hourWindow: { count: number; resetTime: number };
}

export class RateLimiter {
  private static instance: RateLimiter;
  private rateLimits: Map<string, RateLimitConfig> = new Map();
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private processing: Map<string, boolean> = new Map();

  private constructor() {}

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Configure rate limits for a platform
   */
  configurePlatform(platformName: string, config: RateLimitConfig): void {
    this.rateLimits.set(platformName, config);
    this.initializeRateLimitState(platformName);
  }

  /**
   * Queue a request with rate limiting
   */
  async queueRequest<T>(
    platformName: string,
    requestFn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: this.generateRequestId(),
        platformName,
        priority,
        timestamp: new Date(),
        execute: requestFn,
        resolve,
        reject,
      };

      // Add to queue
      if (!this.requestQueues.has(platformName)) {
        this.requestQueues.set(platformName, []);
      }

      const queue = this.requestQueues.get(platformName)!;
      queue.push(request);

      // Sort by priority (higher priority first) and timestamp
      queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

      // Start processing if not already processing
      this.processQueue(platformName);
    });
  }

  /**
   * Process the request queue for a platform
   */
  private async processQueue(platformName: string): Promise<void> {
    if (this.processing.get(platformName)) {
      return; // Already processing
    }

    this.processing.set(platformName, true);

    try {
      const queue = this.requestQueues.get(platformName);
      if (!queue || queue.length === 0) {
        return;
      }

      while (queue.length > 0) {
        const request = queue[0];

        // Check if we can make the request
        if (await this.canMakeRequest(platformName)) {
          // Remove from queue and execute
          queue.shift();
          this.recordRequest(platformName);

          try {
            const result = await request.execute();
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          }
        } else {
          // Wait before checking again
          const waitTime = this.calculateWaitTime(platformName);
          await this.delay(waitTime);
        }
      }
    } finally {
      this.processing.set(platformName, false);
    }
  }

  /**
   * Check if a request can be made within rate limits
   */
  private async canMakeRequest(platformName: string): Promise<boolean> {
    const config = this.rateLimits.get(platformName);
    const state = this.rateLimitStates.get(platformName);

    if (!config || !state) {
      return true; // No limits configured
    }

    const now = Date.now();

    // Reset windows if needed
    if (now >= state.secondWindow.resetTime) {
      state.secondWindow = { count: 0, resetTime: now + 1000 };
    }
    if (now >= state.minuteWindow.resetTime) {
      state.minuteWindow = { count: 0, resetTime: now + 60000 };
    }
    if (now >= state.hourWindow.resetTime) {
      state.hourWindow = { count: 0, resetTime: now + 3600000 };
    }

    // Check limits
    return (
      state.secondWindow.count < config.requestsPerSecond &&
      state.minuteWindow.count < config.requestsPerMinute &&
      state.hourWindow.count < config.requestsPerHour
    );
  }

  /**
   * Record a request being made
   */
  private recordRequest(platformName: string): void {
    const state = this.rateLimitStates.get(platformName);
    if (state) {
      state.secondWindow.count++;
      state.minuteWindow.count++;
      state.hourWindow.count++;
    }
  }

  /**
   * Calculate how long to wait before next request
   */
  private calculateWaitTime(platformName: string): number {
    const config = this.rateLimits.get(platformName);
    const state = this.rateLimitStates.get(platformName);

    if (!config || !state) {
      return 1000; // Default 1 second
    }

    const now = Date.now();
    const waitTimes: number[] = [];

    // Check each window
    if (state.secondWindow.count >= config.requestsPerSecond) {
      waitTimes.push(state.secondWindow.resetTime - now);
    }
    if (state.minuteWindow.count >= config.requestsPerMinute) {
      waitTimes.push(state.minuteWindow.resetTime - now);
    }
    if (state.hourWindow.count >= config.requestsPerHour) {
      waitTimes.push(state.hourWindow.resetTime - now);
    }

    return waitTimes.length > 0 ? Math.max(...waitTimes, 100) : 100;
  }

  /**
   * Initialize rate limit state for a platform
   */
  private initializeRateLimitState(platformName: string): void {
    const now = Date.now();
    this.rateLimitStates.set(platformName, {
      secondWindow: { count: 0, resetTime: now + 1000 },
      minuteWindow: { count: 0, resetTime: now + 60000 },
      hourWindow: { count: 0, resetTime: now + 3600000 },
    });
  }

  /**
   * Get queue status for a platform
   */
  getQueueStatus(platformName: string): {
    queueLength: number;
    processing: boolean;
    rateLimitState: RateLimitState | null;
  } {
    const queue = this.requestQueues.get(platformName) || [];
    const processing = this.processing.get(platformName) || false;
    const rateLimitState = this.rateLimitStates.get(platformName) || null;

    return {
      queueLength: queue.length,
      processing,
      rateLimitState,
    };
  }

  /**
   * Clear queue for a platform
   */
  clearQueue(platformName: string): void {
    const queue = this.requestQueues.get(platformName);
    if (queue) {
      // Reject all pending requests
      queue.forEach(request => {
        request.reject(new Error('Queue cleared'));
      });
      queue.length = 0;
    }
  }

  /**
   * Get all platform statuses
   */
  getAllStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};

    for (const platformName of this.rateLimits.keys()) {
      statuses[platformName] = this.getQueueStatus(platformName);
    }

    return statuses;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const rateLimiter = RateLimiter.getInstance();