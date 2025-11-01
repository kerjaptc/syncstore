/**
 * Dead Letter Queue Management API
 * Task 6.3: Create dead-letter queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DeadLetterQueueService } from '@/lib/queue/deadLetterQueue';
import { z } from 'zod';

// GET /api/sync/dead-letter - Get dead letter queue statistics
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get dead letter queue statistics
    const stats = await DeadLetterQueueService.getDeadLetterStats();

    return NextResponse.json({
      success: true,
      data: {
        stats,
        organization_id: user.organizationId,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Dead letter queue stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DLQ_STATS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch dead letter queue statistics',
        },
      },
      { status: 500 }
    );
  }
}

// Validation schema for bulk retry request
const bulkRetrySchema = z.object({
  criteria: z.object({
    platform: z.enum(['shopee', 'tiktok', 'both']).optional(),
    error_type: z.string().optional(),
    batch_id: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
  }),
});

// POST /api/sync/dead-letter - Bulk retry jobs from dead letter queue
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate request body
    const validatedData = bulkRetrySchema.parse(body);
    const { criteria } = validatedData;

    console.log(`[DLQ] Bulk retry request from user ${user.id}:`, criteria);

    // Perform bulk retry
    const result = await DeadLetterQueueService.bulkRetryJobs(criteria);

    console.log(`[DLQ] Bulk retry result:`, {
      retried: result.retried_count,
      failed: result.failed_count,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        retried_count: result.retried_count,
        failed_count: result.failed_count,
        total_processed: result.retried_count + result.failed_count,
        errors: result.errors,
        criteria_used: criteria,
      },
      message: `Bulk retry completed: ${result.retried_count} jobs retried, ${result.failed_count} failed`,
    });

  } catch (error) {
    console.error('Bulk retry error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BULK_RETRY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to perform bulk retry',
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/sync/dead-letter - Clean up old dead letter jobs
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('older_than_days') || '30');

    if (olderThanDays < 1 || olderThanDays > 365) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DAYS',
            message: 'older_than_days must be between 1 and 365',
          },
        },
        { status: 400 }
      );
    }

    console.log(`[DLQ] Cleanup request from user ${user.id}: older than ${olderThanDays} days`);

    // Perform cleanup
    const cleanedCount = await DeadLetterQueueService.cleanupOldJobs(olderThanDays);

    console.log(`[DLQ] Cleanup completed: ${cleanedCount} jobs removed`);

    return NextResponse.json({
      success: true,
      data: {
        cleaned_count: cleanedCount,
        older_than_days: olderThanDays,
      },
      message: `Cleanup completed: ${cleanedCount} old jobs removed`,
    });

  } catch (error) {
    console.error('DLQ cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CLEANUP_FAILED',
          message: error instanceof Error ? error.message : 'Failed to cleanup dead letter queue',
        },
      },
      { status: 500 }
    );
  }
}