import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SettingsService } from '@/lib/services/settings-service';
import { rateLimiters } from '@/lib/middleware/rate-limit';
import { z } from 'zod';

// Validation schema
const testConnectionSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
});

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { key } = testConnectionSchema.parse(body);

    // Get client info for audit
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const testResult = await SettingsService.testConnection(
      user.organizationId,
      key,
      {
        userId: user.id,
        ipAddress,
        userAgent,
      }
    );

    return NextResponse.json({
      success: true,
      data: testResult,
    });

  } catch (error) {
    console.error('Error testing connection:', error);

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
          code: 'TEST_CONNECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to test connection',
        },
      },
      { status: 500 }
    );
  }
}