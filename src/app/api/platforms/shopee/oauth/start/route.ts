import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createShopeeOAuth } from '@/lib/shopee/oauth';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const env = searchParams.get('env') || 'sandbox';

    if (env !== 'sandbox' && env !== 'production') {
      return NextResponse.json(
        { error: 'Invalid environment. Must be sandbox or production' },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!process.env.SHOPEE_PARTNER_ID || !process.env.SHOPEE_PARTNER_KEY) {
      return NextResponse.json(
        { error: 'Shopee configuration not found. Please check environment variables.' },
        { status: 500 }
      );
    }

    // Create OAuth instance
    const shopeeOAuth = createShopeeOAuth();
    
    // Generate authorization URL
    const { url, timestamp } = shopeeOAuth.generateAuthUrl();
    
    // Log the OAuth attempt (for debugging)
    console.log(`[Shopee OAuth] Starting authorization for user ${userId}`, {
      env,
      timestamp,
      partnerId: process.env.SHOPEE_PARTNER_ID,
      redirectUrl: process.env.SHOPEE_REDIRECT_URL,
    });

    // Store the OAuth state in session/database if needed
    // For now, we'll rely on Clerk's user session

    // Redirect to Shopee authorization page
    return NextResponse.redirect(url);

  } catch (error) {
    console.error('[Shopee OAuth Start] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to start OAuth flow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}