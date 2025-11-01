/**
 * Onboarding API Endpoint
 * Handles organization creation and user setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { UserService } from '@/lib/services/user-service';

const userService = new UserService();

const onboardingSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  userEmail: z.string().email('Valid email is required'),
  organizationName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be less than 100 characters'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters'),
});

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = onboardingSchema.parse(body);

    // Verify the user ID matches the authenticated user
    if (validatedData.userId !== clerkUser.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Check if user already exists in our database
    const existingUser = await userService.getUserWithOrganization(clerkUser.id);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already onboarded' },
        { status: 400 }
      );
    }

    // Create organization and user
    const result = await userService.createOrganization({
      name: validatedData.organizationName,
      userId: validatedData.userId,
      userEmail: validatedData.userEmail,
      userFullName: validatedData.fullName,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
        },
      },
    });
  } catch (error) {
    console.error('Onboarding error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    // Handle database errors
    if (error instanceof Error) {
      // Check for unique constraint violations
      if (error.message.includes('unique constraint')) {
        return NextResponse.json(
          { error: 'Organization name or email already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}