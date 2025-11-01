/**
 * Individual Dead Letter Job Retry API
 * Task 6.3: Create dead-letter queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DeadLetterQueueService } from '@/lib/queue/deadLetterQueue';

// POST /api/sync/dead-letter/[jobId]/retry - Retry individual job from dead letter queue
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await requireAuth();
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_JOB_ID',
            message: 'Job ID is required',
          },
        },
        { status: 400 }
      );
    }

    console.log(`[DLQ] Individual retry request from user ${user.id} for job ${jobId}`);

    // Retry the job
    const result = await DeadLetterQueueService.retryDeadLetterJob(jobId);

    if (result.success) {
      console.log(`[DLQ] Job ${jobId} successfully retried as ${result.newJobId}`);
    } else {
      console.log(`[DLQ] Failed to retry job ${jobId}: ${result.message}`);
    }

    return NextResponse.json({
      success: result.success,
      data: {
        original_job_id: jobId,
        new_job_id: result.newJobId,
        retry_timestamp: new Date().toISOString(),
      },
      message: result.message,
    });

  } catch (error) {
    console.error('Individual retry error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RETRY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retry job',
        },
      },
      { status: 500 }
    );
  }
}