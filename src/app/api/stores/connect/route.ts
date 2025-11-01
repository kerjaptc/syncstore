import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { stores, platforms } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const connectStoreSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  partnerId: z.string().min(1, 'Partner ID is required'),
  partnerKey: z.string().min(1, 'Partner Key is required'),
  shopId: z.string().min(1, 'Shop ID is required'),
  storeName: z.string().min(1, 'Store name is required'),
  isSandbox: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = connectStoreSchema.parse(body);

    // Get platform info
    const platform = await db
      .select()
      .from(platforms)
      .where(eq(platforms.name, validatedData.platform))
      .limit(1);

    if (platform.length === 0) {
      return NextResponse.json(
        { error: 'Platform not found' },
        { status: 404 }
      );
    }

    // For Shopee, validate credentials by making a test API call
    if (validatedData.platform === 'shopee') {
      const isValid = await validateShopeeCredentials({
        partnerId: validatedData.partnerId,
        partnerKey: validatedData.partnerKey,
        shopId: validatedData.shopId,
        isSandbox: validatedData.isSandbox,
      });

      if (!isValid.success) {
        return NextResponse.json(
          { error: isValid.error || 'Invalid Shopee credentials. Please check your Partner ID, Partner Key, and Shop ID.' },
          { status: 400 }
        );
      }
    }

    // Create store record
    const newStore = await db
      .insert(stores)
      .values({
        organizationId: userId, // In real app, this would be the organization ID
        platformId: platform[0].id,
        name: validatedData.storeName,
        platformStoreId: validatedData.shopId,
        credentials: {
          partnerId: validatedData.partnerId,
          partnerKey: validatedData.partnerKey,
          shopId: validatedData.shopId,
        },
        settings: {
          syncEnabled: true,
          syncInterval: 3600, // 1 hour
          autoSync: true,
        },
        syncStatus: 'active',
        isActive: true,
      })
      .returning();

    // Initialize first sync (in background)
    // This would typically be handled by a queue system
    setTimeout(async () => {
      try {
        await initializeStoreSync(newStore[0].id, validatedData.platform);
      } catch (error) {
        console.error('Failed to initialize store sync:', error);
      }
    }, 1000);

    return NextResponse.json({
      success: true,
      store: {
        id: newStore[0].id,
        name: newStore[0].name,
        platform: validatedData.platform,
        status: 'connected',
      },
    });

  } catch (error) {
    console.error('Store connection error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to connect store' },
      { status: 500 }
    );
  }
}

async function validateShopeeCredentials(credentials: {
  partnerId: string;
  partnerKey: string;
  shopId: string;
  isSandbox?: boolean;
}): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // Basic validation
    if (!credentials.partnerId || !credentials.partnerKey || !credentials.shopId) {
      return { success: false, error: 'Missing required credentials' };
    }

    // For sandbox, we have specific validation logic
    if (credentials.isSandbox) {
      return await validateSandboxCredentials(credentials);
    }

    // For production, we would make actual API call to Shopee
    // This is a simplified version - in real implementation you would:
    // 1. Generate proper Shopee API signature using HMAC-SHA256
    // 2. Make authenticated request to Shopee API
    // 3. Handle response and errors properly
    
    const shopeeResponse = await makeShopeeApiCall(credentials);
    return shopeeResponse;

  } catch (error) {
    console.error('Shopee credential validation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error' 
    };
  }
}

async function validateSandboxCredentials(credentials: {
  partnerId: string;
  partnerKey: string;
  shopId: string;
}): Promise<{ success: boolean; error?: string; data?: any }> {
  // Validate against known sandbox credentials
  const validSandboxShopIds = ['226131025']; // Known sandbox shop IDs
  
  if (!validSandboxShopIds.includes(credentials.shopId)) {
    return { 
      success: false, 
      error: `Invalid sandbox Shop ID. Expected one of: ${validSandboxShopIds.join(', ')}` 
    };
  }

  // For sandbox, we accept any partner ID and key as long as they're not empty
  // In real implementation, you'd still validate against sandbox API
  if (credentials.partnerId.length < 5 || credentials.partnerKey.length < 10) {
    return { 
      success: false, 
      error: 'Partner ID must be at least 5 characters and Partner Key at least 10 characters' 
    };
  }

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  return {
    success: true,
    data: {
      shopId: credentials.shopId,
      shopName: 'Sandbox Test Shop',
      status: 'active',
      environment: 'sandbox'
    }
  };
}

async function makeShopeeApiCall(credentials: {
  partnerId: string;
  partnerKey: string;
  shopId: string;
}): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // This is where you'd implement actual Shopee API call
    // For now, we'll simulate it
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock successful response for demo
    return {
      success: true,
      data: {
        shopId: credentials.shopId,
        shopName: 'Production Shop',
        status: 'active',
        environment: 'production'
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: 'Failed to connect to Shopee API'
    };
  }
}

// Removed mockShopeeApiCall - replaced with more specific functions above

async function initializeStoreSync(storeId: string, platform: string): Promise<void> {
  try {
    console.log(`Initializing sync for store ${storeId} on platform ${platform}`);
    
    // In a real implementation, this would:
    // 1. Fetch initial product data from the platform
    // 2. Import products to local database
    // 3. Set up webhooks for real-time updates
    // 4. Schedule periodic sync jobs
    
    // For now, just update the store status
    await db
      .update(stores)
      .set({
        syncStatus: 'syncing',
        lastSyncAt: new Date(),
      })
      .where(eq(stores.id, storeId));

    // Simulate sync process
    setTimeout(async () => {
      await db
        .update(stores)
        .set({
          syncStatus: 'active',
          lastSyncAt: new Date(),
        })
        .where(eq(stores.id, storeId));
    }, 5000);

  } catch (error) {
    console.error('Store sync initialization error:', error);
    
    // Update store status to error
    await db
      .update(stores)
      .set({
        syncStatus: 'error',
      })
      .where(eq(stores.id, storeId));
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get available platforms
    const availablePlatforms = await db
      .select()
      .from(platforms)
      .where(eq(platforms.isActive, true));

    return NextResponse.json({
      platforms: availablePlatforms.map(platform => ({
        id: platform.id,
        name: platform.name,
        displayName: platform.displayName,
        isActive: platform.isActive,
      })),
    });

  } catch (error) {
    console.error('Get platforms error:', error);
    return NextResponse.json(
      { error: 'Failed to get platforms' },
      { status: 500 }
    );
  }
}