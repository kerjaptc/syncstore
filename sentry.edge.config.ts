/**
 * Sentry edge runtime configuration
 */

import * as Sentry from '@sentry/nextjs';
import { env } from '@/env';

Sentry.init({
  dsn: env.SENTRY_DSN,
  
  // Environment and release info
  environment: process.env.NODE_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
  
  // Lower sample rates for edge runtime
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
  
  beforeSend: (event) => {
    // Edge runtime specific filtering
    return event;
  }
});