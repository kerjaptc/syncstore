/**
 * Sentry server-side configuration
 */

import * as Sentry from '@sentry/nextjs';
import { env } from '@/env';

Sentry.init({
  dsn: env.SENTRY_DSN,
  
  // Environment and release info
  environment: process.env.NODE_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
  
  // Performance monitoring (lower sample rate for server)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  
  // Profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  
  integrations: [
    // Add server-specific integrations
  ],
  
  beforeSend: (event) => {
    // Server-side filtering
    if (process.env.NODE_ENV === 'production') {
      // Skip certain types of errors that are not actionable
      const errorMessage = event.exception?.values?.[0]?.value || '';
      
      if (errorMessage.includes('ECONNRESET') || errorMessage.includes('EPIPE')) {
        return null;
      }
    }
    
    return event;
  },
  
  beforeSendTransaction: (event) => {
    // Filter out internal Next.js transactions
    if (event.transaction?.startsWith('/_next/')) {
      return null;
    }
    
    return event;
  }
});