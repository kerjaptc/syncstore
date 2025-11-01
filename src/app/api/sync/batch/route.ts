import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { syncQueueService } from '@/lib/queue/syncQueue';
import { z } from 'zod';

// Validation schema for batch sync request
const batchSyncSchema = z.object({
  product_ids: z.array(z.string().uuid('Invalid product ID')).min(1, 'At least one product ID is required').max(100, 'Maximum 100 products per batch'),
  platform: z.enum(['shopee', 'tiktok', 'both'], {
    errorMap: () => ({ message: 'Platform must be shopee, tiktok, or both' }),
  }),
});

// POST /api/sync/batch - Batch sync endpoint
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate request body
    const validatedData = batchSyncSchema.parse(body);
    const { product_ids, platform } = validatedData;

    // Generate batch ID
    const batch_id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[BATCH_SYNC] Starting batch sync - Batch ID: ${batch_id}, Products: ${product_ids.length}, Platform: ${platform}`);

    // Add batch coordinator job
    const batchJobId = await syncQueueService.addBatchSyncJob({
      product_ids,
      platform,
      batch_id,
      organization_id: user.organizationId,
      batch_size: product_ids.length,
      created_by: user.id,
    });

    // Add individual sync jobs for each product
    const jobIds = await syncQueueService.addBatchJobs(
      product_ids,
      platform,
      batch_id,
      user.organizationId
    );

    console.log(`[BATCH_SYNC] Queued ${jobIds.length} sync jobs for batch ${batch_id}`);

    return NextResponse.json({
      success: true,
      batch_id,
      batch_job_id: batchJobId,
      total_jobs: jobIds.length,
      individual_job_ids: jobIds,
      message: `Batch sync started with ${jobIds.length} products`,
      estimated_duration_minutes: Math.ceil(jobIds.length * 0.5), // Estimate 30 seconds per product
    });

  } catch (error) {
    console.error('Batch sync error:', error);

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
          code: 'BATCH_SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to start batch sync',
        },
      },
      { status: 500 }
    );
  }
}