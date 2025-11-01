import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SettingsService } from '@/lib/services/settings-service';
import { rateLimiters } from '@/lib/middleware/rate-limit';
import { z } from 'zod';

// Validation schema
const getAuditLogSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.api(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await requireAuth();
    
    // Check if user has admin permissions
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { limit } = getAuditLogSchema.parse(queryParams);

    const auditLog = await SettingsService.getAuditLog(user.organizationId, limit);

    return NextResponse.json({
      success: true,
      data: auditLog,
    });

  } catch (error) {
    console.error('Error fetching audit log:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
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
          code: 'FETCH_AUDIT_LOG_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch audit log',
        },
      },
      { status: 500 }
    );
  }
}