import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SettingsService } from '@/lib/services/settings-service';
import { rateLimiters } from '@/lib/middleware/rate-limit';
import { z } from 'zod';

// Validation schemas
const getSettingsSchema = z.object({
  masked: z.coerce.boolean().default(true),
});

const setSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  value: z.string().min(1, 'Setting value is required'),
  isSensitive: z.boolean().default(true),
  description: z.string().optional(),
});

const deleteSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
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
    const { masked } = getSettingsSchema.parse(queryParams);

    // Get settings (masked or full based on request)
    const settings = masked 
      ? await SettingsService.getMaskedSettings(user.organizationId)
      : await SettingsService.getSettings(user.organizationId);

    return NextResponse.json({
      success: true,
      data: settings,
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    
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
          code: 'FETCH_SETTINGS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch settings',
        },
      },
      { status: 500 }
    );
  }
}

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
    const { key, value, isSensitive, description } = setSettingSchema.parse(body);

    // Get client info for audit
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await SettingsService.setSetting(
      user.organizationId,
      key,
      value,
      {
        isSensitive,
        description,
        auditContext: {
          userId: user.id,
          ipAddress,
          userAgent,
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Setting saved successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error saving setting:', error);
    
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
          code: 'SAVE_SETTING_ERROR',
          message: error instanceof Error ? error.message : 'Failed to save setting',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { key } = deleteSettingSchema.parse(body);

    // Get client info for audit
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await SettingsService.deleteSetting(
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
      message: 'Setting deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting setting:', error);
    
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
          code: 'DELETE_SETTING_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete setting',
        },
      },
      { status: 500 }
    );
  }
}