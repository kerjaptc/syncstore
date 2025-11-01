/**
 * Clerk Configuration and Timeout Handling
 * Provides fallback mechanisms for Clerk authentication issues
 */

export const clerkConfig = {
  // Increase timeout for slow connections
  timeout: 10000, // 10 seconds instead of default 5
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // 1 second between retries
  
  // Development mode optimizations
  development: {
    // Disable some features that might cause timeouts
    skipInactiveCheck: true,
    reducedPolling: true,
  },
};

/**
 * Handle Clerk loading errors gracefully
 */
export function handleClerkError(error: any): void {
  console.warn('Clerk loading issue:', error);
  
  if (error?.code === 'failed_to_load_clerk_js_timeout') {
    console.log('🔧 Clerk Timeout Solutions:');
    console.log('1. Clear browser cache and cookies');
    console.log('2. Try incognito/private mode');
    console.log('3. Check network connectivity');
    console.log('4. Restart development server');
    console.log('5. Run: npm run fix:clerk');
  }
}

/**
 * Clerk initialization with error handling
 */
export function initializeClerk(): void {
  if (typeof window !== 'undefined') {
    // Add global error handler for Clerk
    window.addEventListener('error', (event) => {
      if (event.error?.message?.includes('Clerk')) {
        handleClerkError(event.error);
      }
    });

    // Add unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('Clerk')) {
        handleClerkError(event.reason);
        event.preventDefault(); // Prevent console error
      }
    });
  }
}

/**
 * Check if Clerk is properly configured
 */
export function validateClerkConfig(): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check environment variables
  const publicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!publicKey) {
    issues.push('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  } else if (!publicKey.startsWith('pk_')) {
    issues.push('Invalid publishable key format');
  }

  if (!secretKey) {
    issues.push('Missing CLERK_SECRET_KEY');
  } else if (!secretKey.startsWith('sk_')) {
    issues.push('Invalid secret key format');
  }

  // Check for common issues
  if (typeof window !== 'undefined') {
    // Browser-side checks
    if (!navigator.onLine) {
      issues.push('No internet connection');
      recommendations.push('Check your internet connection');
    }

    // Check for ad blockers or extensions that might block Clerk
    if (window.location.protocol === 'https:' && window.location.hostname === 'localhost') {
      issues.push('Using HTTPS with localhost');
      recommendations.push('Use HTTP for localhost development');
    }
  }

  // Recommendations based on issues
  if (issues.length > 0) {
    recommendations.push('Run: npm run fix:clerk for detailed solutions');
    recommendations.push('Clear browser cache and cookies');
    recommendations.push('Try incognito/private mode');
    recommendations.push('Restart development server');
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  initializeClerk();
}