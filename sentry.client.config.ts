/**
 * Sentry client-side configuration
 */

import * as Sentry from '@sentry/nextjs';
import { env } from '@/env';

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment and release info
  environment: process.env.NODE_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session replay
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*\.storesync\.com/,
        /^https:\/\/api\.storesync\.com/
      ]
    }),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
      maskAllInputs: true
    })
  ],
  
  beforeSend: (event) => {
    // Filter out development errors in production
    if (process.env.NODE_ENV === 'production') {
      // Skip chunk load errors (common in SPAs)
      if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
        return null;
      }
      
      // Skip network errors that are not actionable
      if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
        return null;
      }
    }
    
    return event;
  },
  
  beforeSendTransaction: (event) => {
    // Filter out transactions we don't want to track
    if (event.transaction?.includes('/_next/')) {
      return null;
    }
    
    return event;
  }
});