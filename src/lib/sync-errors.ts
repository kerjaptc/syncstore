// Error message mapping for user-friendly sync error handling

export interface SyncError {
  code: string;
  userMessage: string;
  technicalMessage: string;
  suggestion: string;
  retryable: boolean;
  retryAfter?: number; // seconds
}

export const SYNC_ERROR_MESSAGES: Record<string, SyncError> = {
  'SHOPEE_RATE_LIMIT': {
    code: 'SHOPEE_RATE_LIMIT',
    userMessage: 'Too many requests to Shopee. Please wait a moment and try again.',
    technicalMessage: '429 Too Many Requests from Shopee API',
    suggestion: 'Wait 5 minutes before retrying. Shopee limits the number of requests per hour.',
    retryable: true,
    retryAfter: 300, // 5 minutes
  },
  'INVALID_PRODUCT_DATA': {
    code: 'INVALID_PRODUCT_DATA',
    userMessage: 'Product information is incomplete or invalid.',
    technicalMessage: 'Missing required fields: title, price, or images',
    suggestion: 'Check that your product has a title, price, and at least one image before syncing.',
    retryable: true,
  },
  'CONNECTION_TIMEOUT': {
    code: 'CONNECTION_TIMEOUT',
    userMessage: 'Connection to Shopee timed out.',
    technicalMessage: 'Request timeout after 30 seconds',
    suggestion: 'Check your internet connection and try again. If the problem persists, Shopee may be experiencing issues.',
    retryable: true,
    retryAfter: 60, // 1 minute
  },
  'SHOPEE_API_ERROR': {
    code: 'SHOPEE_API_ERROR',
    userMessage: 'Shopee service is temporarily unavailable.',
    technicalMessage: 'Shopee API returned 5xx error',
    suggestion: 'This is a temporary issue with Shopee. Please try again in a few minutes.',
    retryable: true,
    retryAfter: 180, // 3 minutes
  },
  'PRODUCT_ALREADY_EXISTS': {
    code: 'PRODUCT_ALREADY_EXISTS',
    userMessage: 'This product already exists on Shopee.',
    technicalMessage: 'Product with same SKU already exists on platform',
    suggestion: 'Update the existing product instead of creating a new one, or change the product SKU.',
    retryable: false,
  },
  'INSUFFICIENT_PERMISSIONS': {
    code: 'INSUFFICIENT_PERMISSIONS',
    userMessage: 'You don\'t have permission to sync products to Shopee.',
    technicalMessage: 'API key lacks required permissions',
    suggestion: 'Contact your administrator to check your Shopee API permissions.',
    retryable: false,
  },
  'NETWORK_ERROR': {
    code: 'NETWORK_ERROR',
    userMessage: 'Network connection failed.',
    technicalMessage: 'Failed to connect to sync service',
    suggestion: 'Check your internet connection and try again.',
    retryable: true,
    retryAfter: 30, // 30 seconds
  },
  'UNKNOWN_ERROR': {
    code: 'UNKNOWN_ERROR',
    userMessage: 'An unexpected error occurred during sync.',
    technicalMessage: 'Unknown error',
    suggestion: 'Please try again. If the problem persists, contact support.',
    retryable: true,
    retryAfter: 60, // 1 minute
  },
};

export function getSyncError(errorMessage: string): SyncError {
  // Try to match error message to known error codes
  for (const [code, error] of Object.entries(SYNC_ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(code.toLowerCase().replace('_', ' ')) ||
        errorMessage.toLowerCase().includes(error.technicalMessage.toLowerCase())) {
      return error;
    }
  }

  // Check for specific patterns
  if (errorMessage.toLowerCase().includes('rate limit') || errorMessage.includes('429')) {
    return SYNC_ERROR_MESSAGES.SHOPEE_RATE_LIMIT;
  }

  if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
    return SYNC_ERROR_MESSAGES.CONNECTION_TIMEOUT;
  }

  if (errorMessage.toLowerCase().includes('permission') || errorMessage.includes('401') || errorMessage.includes('403')) {
    return SYNC_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS;
  }

  if (errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('duplicate')) {
    return SYNC_ERROR_MESSAGES.PRODUCT_ALREADY_EXISTS;
  }

  if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('missing') || errorMessage.includes('400')) {
    return SYNC_ERROR_MESSAGES.INVALID_PRODUCT_DATA;
  }

  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
    return SYNC_ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Default to unknown error
  return {
    ...SYNC_ERROR_MESSAGES.UNKNOWN_ERROR,
    technicalMessage: errorMessage,
  };
}

export function formatRetryTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}