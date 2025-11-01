import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { JobStatusService } from '@/lib/queue/jobStatus';

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

    // Get batch status using JobStatusService
    const batchStatus = await JobStatusService.getBatchStatus(batch_id);

    if (!batchStatus) {
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

    // Add computed fields for UI
    const responseData = {
      ...batchStatus,
      is_complete: batchStatus.status === 'completed' || batchStatus.status === 'failed' || batchStatus.status === 'mixed',
      success_rate: batchStatus.total_jobs > 0 
        ? Math.round((batchStatus.completed / batchStatus.total_jobs) * 100)
        : 0,
      failure_rate: batchStatus.total_jobs > 0 
        ? Math.round((batchStatus.failed / batchStatus.total_jobs) * 100)
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
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