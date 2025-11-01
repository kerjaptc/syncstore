import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createShopeeOAuth } from '@/lib/shopee/oauth';
import { db } from '@/lib/db';
import { shopConnections } from '@/lib/db/shop-connections';
import { eq, and } from 'drizzle-orm';

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
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        { error: 'Shop ID is required' },
        { status: 400 }
      );
    }

    // Get connection from database
    const connection = await db
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

    if (connection.length === 0) {
      return NextResponse.json(
        { error: 'Shop connection not found' },
        { status: 404 }
      );
    }

    const conn = connection[0];

    // Check if token is expired
    const now = new Date();
    if (conn.expiresAt && conn.expiresAt <= now) {
      return NextResponse.json(
        { 
          status: 'Unauthorized',
          error: 'Access token expired',
          shopId,
          shopName: conn.shopName,
          lastCheck: now.toISOString(),
        },
        { status: 401 }
      );
    }

    // Create OAuth instance and test connection
    const shopeeOAuth = createShopeeOAuth();
    
    try {
      const shopInfo = await shopeeOAuth.getShopInfo(conn.accessToken, shopId);
      
      // Update health status in database
      await db
        .update(shopConnections)
        .set({
          lastHealthCheck: now,
          healthStatus: 'ok',
          shopInfo: shopInfo,
          updatedAt: now,
        })
        .where(eq(shopConnections.id, conn.id));

      return NextResponse.json({
        status: 'OK',
        shopId,
        shopName: shopInfo.shop_name || conn.shopName,
        shopStatus: shopInfo.status,
        environment: conn.environment,
        lastCheck: now.toISOString(),
        tokenExpiresAt: conn.expiresAt?.toISOString(),
      });

    } catch (apiError) {
      let healthStatus = 'error';
      let statusCode = 500;

      // Parse specific error types
      if (apiError instanceof Error) {
        if (apiError.message.includes('401') || apiError.message.includes('Unauthorized')) {
          healthStatus = 'unauthorized';
          statusCode = 401;
        } else if (apiError.message.includes('429') || apiError.message.includes('rate')) {
          healthStatus = 'rate_limited';
          statusCode = 429;
        }
      }

      // Update health status in database
      await db
        .update(shopConnections)
        .set({
          lastHealthCheck: now,
          healthStatus,
          updatedAt: now,
        })
        .where(eq(shopConnections.id, conn.id));

      return NextResponse.json(
        {
          status: healthStatus === 'unauthorized' ? 'Unauthorized' : 
                  healthStatus === 'rate_limited' ? 'RateLimited' : 'Error',
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
          shopId,
          shopName: conn.shopName,
          environment: conn.environment,
          lastCheck: now.toISOString(),
        },
        { status: statusCode }
      );
    }

  } catch (error) {
    console.error('[Shopee Health Check] Error:', error);
    
    return NextResponse.json(
      { 
        status: 'Error',
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}