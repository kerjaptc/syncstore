/**
 * Individual Job Status API Endpoint
 * Task 5.2: Implement job status tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { JobStatusService } from '@/lib/queue/jobStatus';

// GET /api/sync/job/[jobId] - Get individual job status
export async function GET(
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

    // Get job status
    const jobStatus = await JobStatusService.getJobStatus(jobId);

    if (!jobStatus) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobStatus,
    });

  } catch (error) {
    console.error('Job status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'JOB_STATUS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch job status',
        },
      },
      { status: 500 }
    );
  }
}