import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    responseTime: number;
  };
}

/**
 * Log API operations with timing
 */
function logAPI(operation: string, duration: number, resultCount?: number, error?: string): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const result = resultCount !== undefined ? ` result=${resultCount} items` : '';
  const errorMsg = error ? ` error="${error}"` : '';
  console.log(`[${timestamp}] [API] ${operation} duration=${duration}ms${result}${errorMsg}`);
}

/**
 * Log sync events
 */
function logSync(operation: string, status: string, details?: any): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const detailsStr = details ? ` details=${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [SYNC] ${operation} status=${status}${detailsStr}`);
}

/**
 * Get organization ID
 */
async function getOrganizationId(): Promise<string> {
  try {
    const orgs = await sql`SELECT id FROM organizations LIMIT 1`;
    if (orgs.length === 0) {
      throw new Error('No organization found');
    }
    return orgs[0].id;
  } catch (error) {
    throw new Error(`Failed to get organization: ${error}`);
  }
}

/**
 * Create sync log entry
 */
async function createSyncLog(
  syncJobId: string,
  level: 'info' | 'warning' | 'error',
  message: string,
  productId?: string,
  platform?: string,
  details?: any
): Promise<void> {
  try {
    await sql`
      INSERT INTO sync_logs (
        id, sync_job_id, level, message, product_id, platform, details, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${syncJobId}, ${level}, ${message},
        ${productId || null}, ${platform || null}, ${JSON.stringify(details || {})}, NOW()
      )
    `;
  } catch (error) {
    console.error('Failed to create sync log:', error);
  }
}

/**
 * POST /api/sync/cancel - Cancel a running sync operation
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const syncJobId = searchParams.get('syncJobId');
    
    if (!syncJobId) {
      const response: APIResponse<never> = {
        success: false,
        error: 'syncJobId parameter is required',
        meta: {
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };
      
      return NextResponse.json(response, { status: 400 });
    }
    
    // Get organization ID for security
    const organizationId = await getOrganizationId();
    
    // Get sync job details
    const syncJob = await sql`
      SELECT id, status, type
      FROM sync_jobs
      WHERE id = ${syncJobId} AND organization_id = ${organizationId}
    `;
    
    if (syncJob.length === 0) {
      const response: APIResponse<never> = {
        success: false,
        error: 'Sync job not found',
        meta: {
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };
      
      return NextResponse.json(response, { status: 404 });
    }
    
    const job = syncJob[0];
    
    // Check if job can be cancelled
    if (job.status === 'completed' || job.status === 'completed_with_errors') {
      const response: APIResponse<never> = {
        success: false,
        error: 'Cannot cancel a completed sync operation',
        meta: {
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };
      
      return NextResponse.json(response, { status: 400 });
    }
    
    if (job.status === 'cancelled') {
      const response: APIResponse<never> = {
        success: false,
        error: 'Sync operation is already cancelled',
        meta: {
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };
      
      return NextResponse.json(response, { status: 400 });
    }
    
    if (job.status === 'failed') {
      const response: APIResponse<never> = {
        success: false,
        error: 'Cannot cancel a failed sync operation',
        meta: {
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };
      
      return NextResponse.json(response, { status: 400 });
    }
    
    // Update sync job status to cancelled
    await sql`
      UPDATE sync_jobs 
      SET 
        status = 'cancelled',
        completed_at = NOW(),
        error = 'Cancelled by user'
      WHERE id = ${syncJobId}
    `;
    
    // Create cancellation log
    await createSyncLog(
      syncJobId,
      'warning',
      'Sync operation cancelled by user',
      undefined,
      undefined,
      { previousStatus: job.status, cancelledAt: new Date().toISOString() }
    );
    
    logSync('Sync Cancelled', 'cancelled', { syncJobId, previousStatus: job.status });
    
    const duration = Date.now() - startTime;
    logAPI(`POST /api/sync/cancel (${syncJobId})`, duration, 1);
    
    const response: APIResponse<{ syncJobId: string; status: string }> = {
      success: true,
      data: {
        syncJobId,
        status: 'cancelled'
      },
      meta: {
        timestamp: new Date().toISOString(),
        responseTime: duration
      }
    };
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logAPI('POST /api/sync/cancel', duration, undefined, errorMessage);
    
    const response: APIResponse<never> = {
      success: false,
      error: `Failed to cancel sync: ${errorMessage}`,
      meta: {
        timestamp: new Date().toISOString(),
        responseTime: duration
      }
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}
