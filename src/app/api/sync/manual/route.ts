import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { masterProducts } from '@/lib/db/master-catalog-schema';
import { syncLogs } from '@/lib/db/sync-logs-schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for manual sync request
const manualSyncSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  target_platform: z.enum(['shopee', 'tiktok', 'both'], {
    errorMap: () => ({ message: 'Platform must be shopee, tiktok, or both' }),
  }),
});

// POST /api/sync/manual - Manual sync endpoint
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate request body
    const validatedData = manualSyncSchema.parse(body);
    const { product_id, target_platform } = validatedData;

    // Get product from master catalog
    const product = await db
      .select()
      .from(masterProducts)
      .where(and(
        eq(masterProducts.id, product_id),
        eq(masterProducts.organizationId, user.organizationId)
      ))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PRODUCT',
            message: 'Product not found in master catalog',
          },
        },
        { status: 404 }
      );
    }

    const masterProduct = product[0];

    // Generate sync ID for tracking
    const sync_id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Simulate sync process (in real implementation, this would call platform APIs)
    const syncResult = await simulateSync(masterProduct, target_platform, sync_id);

    // Log sync operation to database
    try {
      await db.insert(syncLogs).values({
        productId: product_id,
        platform: target_platform,
        status: syncResult.success ? 'success' : 'failed',
        requestPayload: {
          sync_id,
          product_sku: masterProduct.masterSku,
          product_name: masterProduct.name,
          base_price: masterProduct.basePrice,
          target_platform,
          timestamp,
        },
        responsePayload: syncResult.success ? {
          external_id: syncResult.external_id,
          pricing: syncResult.pricing,
          seo_titles: syncResult.seo_titles,
        } : {
          error_code: syncResult.error_code,
          error_message: syncResult.error_message,
        },
        platformProductId: syncResult.success ? 
          (typeof syncResult.external_id === 'string' ? syncResult.external_id : JSON.stringify(syncResult.external_id)) : null,
        errorMessage: syncResult.success ? null : syncResult.error_message,
        errorCode: syncResult.success ? null : syncResult.error_code,
        attempts: 1,
        syncedAt: new Date(),
      });
    } catch (logError) {
      console.error('Failed to log sync operation:', logError);
      // Continue execution even if logging fails
    }

    if (!syncResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: syncResult.error_code,
            message: syncResult.error_message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sync_id,
      platform: target_platform,
      message: `Product synced successfully to ${target_platform}`,
      data: {
        external_id: syncResult.external_id,
        timestamp,
        status: 'synced',
        pricing: syncResult.pricing,
      },
    });

  } catch (error) {
    console.error('Manual sync error:', error);

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
          code: 'SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to sync product',
        },
      },
      { status: 500 }
    );
  }
}

// Simulate sync process (replace with real platform API calls in production)
async function simulateSync(
  product: any,
  platform: 'shopee' | 'tiktok' | 'both',
  sync_id: string
) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Simulate occasional failures (5% chance)
  if (Math.random() < 0.05) {
    const errorCodes = ['RATE_LIMITED', 'NETWORK_ERROR', 'INVALID_CREDENTIALS'];
    const errorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    
    return {
      success: false,
      error_code: errorCode,
      error_message: getErrorMessage(errorCode),
    };
  }

  // Calculate platform-specific pricing
  const basePrice = parseFloat(product.basePrice);
  const pricing: any = {};

  if (platform === 'shopee' || platform === 'both') {
    pricing.shopee = (basePrice * 1.15).toFixed(2);
  }
  
  if (platform === 'tiktok' || platform === 'both') {
    pricing.tiktok = (basePrice * 1.20).toFixed(2);
  }

  // Generate mock external IDs
  const external_id = platform === 'both' ? {
    shopee: `shopee_${Date.now()}`,
    tiktok: `tiktok_${Date.now()}`,
  } : `${platform}_${Date.now()}`;

  return {
    success: true,
    external_id,
    pricing,
    seo_titles: generateSEOTitles(product, platform),
  };
}

// Generate SEO titles (70-80% similar to master, 20-30% variation)
function generateSEOTitles(product: any, platform: 'shopee' | 'tiktok' | 'both') {
  const masterTitle = product.name;
  const brand = product.brand;
  
  const titles: any = {};

  if (platform === 'shopee' || platform === 'both') {
    // Shopee SEO: Add platform-specific keywords
    titles.shopee = `${masterTitle} ${brand} [BEST SELLER] - Original & Berkualitas`;
  }

  if (platform === 'tiktok' || platform === 'both') {
    // TikTok SEO: Different variation
    titles.tiktok = `${brand} ${masterTitle} - Kualitas Premium untuk FPV Racing`;
  }

  return titles;
}

// Get user-friendly error messages
function getErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'RATE_LIMITED':
      return 'API rate limit exceeded. Please try again in a few minutes.';
    case 'NETWORK_ERROR':
      return 'Network connection error. Please check your internet connection.';
    case 'INVALID_CREDENTIALS':
      return 'Platform credentials are invalid or expired. Please reconnect your account.';
    case 'INVALID_PRODUCT':
      return 'Product data is invalid or incomplete.';
    default:
      return 'An unknown error occurred during sync.';
  }
}