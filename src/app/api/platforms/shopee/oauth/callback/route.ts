import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createShopeeOAuth } from '@/lib/shopee/oauth';
import { db } from '@/lib/db';
import { shopConnections } from '@/lib/db/shop-connections';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      // Redirect to login page with return URL
      const loginUrl = new URL('/sign-in', request.url);
      loginUrl.searchParams.set('redirect_url', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const shopId = searchParams.get('shop_id');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[Shopee OAuth Callback] OAuth error:', error);
      const errorUrl = new URL('/dashboard/stores', request.url);
      errorUrl.searchParams.set('error', `oauth_error_${error}`);
      return NextResponse.redirect(errorUrl);
    }

    // Validate required parameters
    if (!code || !shopId) {
      console.error('[Shopee OAuth Callback] Missing parameters:', { code: !!code, shopId: !!shopId });
      const errorUrl = new URL('/dashboard/stores', request.url);
      errorUrl.searchParams.set('error', 'missing_oauth_parameters');
      return NextResponse.redirect(errorUrl);
    }

    // Create OAuth instance
    const shopeeOAuth = createShopeeOAuth();
    
    console.log(`[Shopee OAuth Callback] Processing callback for user ${userId}`, {
      shopId,
      hasCode: !!code,
    });

    // Exchange code for tokens
    const tokenResponse = await shopeeOAuth.exchangeToken(code, shopId);
    
    console.log(`[Shopee OAuth Callback] Token exchange successful`, {
      shopId: tokenResponse.shop_id,
      expiresIn: tokenResponse.expire_in,
    });

    // Get shop information
    const shopInfo = await shopeeOAuth.getShopInfo(tokenResponse.access_token, shopId);
    
    console.log(`[Shopee OAuth Callback] Shop info retrieved`, {
      shopName: shopInfo.shop_name,
      status: shopInfo.status,
    });

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + tokenResponse.expire_in * 1000);

    // Mask partner key for storage (only show last 4 characters)
    const partnerKeyMasked = process.env.SHOPEE_PARTNER_KEY 
      ? `****${process.env.SHOPEE_PARTNER_KEY.slice(-4)}`
      : '****';

    // Check if connection already exists
    const existingConnection = await db
      .select()
      .from(shopConnections)
      .where(
        and(
          eq(shopConnections.platform, 'shopee'),
          eq(shopConnections.shopId, shopId),
          eq(shopConnections.environment, process.env.SHOPEE_ENV || 'sandbox')
        )
      )
      .limit(1);

    if (existingConnection.length > 0) {
      // Update existing connection
      await db
        .update(shopConnections)
        .set({
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresIn: tokenResponse.expire_in,
          expiresAt,
          shopName: shopInfo.shop_name,
          shopStatus: shopInfo.status,
          shopInfo: shopInfo,
          partnerKeyMasked,
          isActive: true,
          lastHealthCheck: new Date(),
          healthStatus: 'ok',
          updatedAt: new Date(),
        })
        .where(eq(shopConnections.id, existingConnection[0].id));

      console.log(`[Shopee OAuth Callback] Updated existing connection ${existingConnection[0].id}`);
    } else {
      // Create new connection
      const connectionId = uuidv4();
      
      await db
        .insert(shopConnections)
        .values({
          id: connectionId,
          platform: 'shopee',
          shopId,
          environment: process.env.SHOPEE_ENV || 'sandbox',
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresIn: tokenResponse.expire_in,
          expiresAt,
          shopName: shopInfo.shop_name,
          shopStatus: shopInfo.status,
          shopInfo: shopInfo,
          partnerKeyMasked,
          isActive: true,
          lastHealthCheck: new Date(),
          healthStatus: 'ok',
        });

      console.log(`[Shopee OAuth Callback] Created new connection ${connectionId}`);
    }

    // Redirect to success page
    const successUrl = new URL('/dashboard/stores', request.url);
    successUrl.searchParams.set('success', 'shopee_connected');
    successUrl.searchParams.set('shop_id', shopId);
    successUrl.searchParams.set('shop_name', shopInfo.shop_name || 'Unknown');
    
    return NextResponse.redirect(successUrl);

  } catch (error) {
    console.error('[Shopee OAuth Callback] Error:', error);
    
    // Redirect to error page
    const errorUrl = new URL('/dashboard/stores', request.url);
    errorUrl.searchParams.set('error', 'oauth_callback_failed');
    errorUrl.searchParams.set('details', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.redirect(errorUrl);
  }
}