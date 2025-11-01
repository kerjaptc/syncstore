/**
 * Error reporting endpoint for client-side errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/error-handling';
import { ErrorType, ErrorSeverity } from '@/lib/error-handling/types';
import { getLogger } from '@/lib/error-handling';
import { captureAppError } from '@/lib/error-handling/sentry';
import { getNotificationService } from '@/lib/error-handling/notification';
import { withErrorHandler } from '@/lib/error-handling/middleware';

const logger = getLogger('error-reporting');

const errorReportSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  url: z.string().url(),
  userAgent: z.string(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  level: z.enum(['error', 'warning', 'info']).default('error'),
  context: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional()
});

async function handleErrorReport(req: NextRequest) {
  const body = await req.json();
  
  // Validate request body
  const validationResult = errorReportSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid error report format',
        details: validationResult.error.errors
      },
      { status: 400 }
    );
  }

  const errorData = validationResult.data;

  // Create AppError from client report
  const appError = new AppError(
    ErrorType.INTERNAL_ERROR,
    errorData.message,
    'CLIENT_ERROR',
    {
      severity: errorData.level === 'error' ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
      details: {
        url: errorData.url,
        userAgent: errorData.userAgent,
        stack: errorData.stack,
        clientTimestamp: errorData.timestamp
      },
      context: {
        operation: 'client_error_report',
        component: 'client',
        metadata: errorData.context
      },
      userId: errorData.userId,
      organizationId: errorData.organizationId
    }
  );

  // Log the error
  logger.error('Client error reported', appError, {
    url: errorData.url,
    userAgent: errorData.userAgent
  });

  // Capture in Sentry
  const errorId = captureAppError(appError, {
    clientReport: true,
    url: errorData.url,
    userAgent: errorData.userAgent
  });

  // Send notification for critical client errors
  if (appError.shouldAlert()) {
    await getNotificationService().notifyError(appError, {
      source: 'client_error_report',
      url: errorData.url,
      userAgent: errorData.userAgent
    });
  }

  return NextResponse.json({
    success: true,
    errorId,
    message: 'Error report received'
  });
}

export const POST = withErrorHandler(handleErrorReport);