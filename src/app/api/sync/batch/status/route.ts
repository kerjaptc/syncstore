import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { syncQueueService } from '@/lib/queue/syncQueue';
import { z } from 'zod';

// GET /api/sync/batch/status?batch_id=xxx - Get batch sync status
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const batch_id = searchParams.get('batch_id');

    if (!batch_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_BATCH_ID',
            message: 'batch_id parameter is required',
          },
        },
        { status: 400 }
      );
    }

    // Get batch status from queue service
    const batchStatus = await syncQueueService.getBatchStatus(batch_id);

    if (batchStatus.total_jobs === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BATCH_NOT_FOUND',
            message: 'Batch not found or no jobs in batch',
          },
        },
        { status: 404 }
      );
    }

    // Calculate progress percentage
    const progressPercentage = batchStatus.total_jobs > 0 
      ? Math.round(((batchStatus.completed + batchStatus.failed) / batchStatus.total_jobs) * 100)
      : 0;

    // Estimate remaining time
    const remainingJobs = batchStatus.pending + batchStatus.in_progress;
    const estimatedRemainingMinutes = Math.ceil(remainingJobs * 0.5); // 30 seconds per job

    return NextResponse.json({
      success: true,
      data: {
        ...batchStatus,
        progress_percentage: progressPercentage,
        estimated_remaining_minutes: estimatedRemainingMinutes,
        is_complete: batchStatus.status === 'completed' || batchStatus.status === 'completed_with_errors',
        success_rate: batchStatus.total_jobs > 0 
          ? Math.round((batchStatus.completed / batchStatus.total_jobs) * 100)
          : 0,
      },
    });

  } catch (error) {
    console.error('Batch status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATUS_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch batch status',
        },
      },
      { status: 500 }
    );
  }
}