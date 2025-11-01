/**
 * Test authentication flows for Phase 1
 * This file tests OAuth implementations without making actual API calls
 */

import { createShopeeOAuth } from '@/lib/shopee/oauth';
import { TikTokShopAuth } from '@/lib/platforms/tiktokshop/tiktokshop-auth';

export interface AuthTestResult {
  platform: string;
  status: 'success' | 'error';
  message: string;
  details?: any;
}

/**
 * Test Shopee OAuth configuration and URL generation
 */
export async function testShopeeAuth(): Promise<AuthTestResult> {
  try {
    // Check if required environment variables are set
    if (!process.env.SHOPEE_PARTNER_ID || process.env.SHOPEE_PARTNER_ID === 'your_partner_id_here') {
      return {
        platform: 'shopee',
        status: 'error',
        message: 'Shopee Partner ID not configured (still placeholder)',
        details: { partnerId: process.env.SHOPEE_PARTNER_ID }
      };
    }

    if (!process.env.SHOPEE_PARTNER_KEY || process.env.SHOPEE_PARTNER_KEY === 'your_partner_key_here') {
      return {
        platform: 'shopee',
        status: 'error',
        message: 'Shopee Partner Key not configured (still placeholder)',
        details: { partnerKey: process.env.SHOPEE_PARTNER_KEY?.slice(0, 4) + '...' }
      };
    }

    // Test OAuth instance creation
    const shopeeOAuth = createShopeeOAuth();
    
    // Test URL generation (this doesn't make API calls)
    const { url, timestamp } = shopeeOAuth.generateAuthUrl();
    
    // Validate URL structure
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    const hasRequiredParams = 
      params.has('partner_id') &&
      params.has('timestamp') &&
      params.has('redirect') &&
      params.has('sign');

    if (!hasRequiredParams) {
      return {
        platform: 'shopee',
        status: 'error',
        message: 'Generated OAuth URL missing required parameters',
        details: { url, params: Object.fromEntries(params) }
      };
    }

    return {
      platform: 'shopee',
      status: 'success',
      message: 'Shopee OAuth configuration valid and URL generation working',
      details: {
        host: urlObj.host,
        partnerId: params.get('partner_id'),
        timestamp,
        hasSignature: params.has('sign')
      }
    };

  } catch (error) {
    return {
      platform: 'shopee',
      status: 'error',
      message: `Shopee OAuth test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
}

/**
 * Test TikTok Shop OAuth configuration
 */
export async function testTikTokShopAuth(): Promise<AuthTestResult> {
  try {
    // Check if required environment variables are set
    if (!process.env.TIKTOK_SHOP_APP_KEY || process.env.TIKTOK_SHOP_APP_KEY === 'your_app_key_here') {
      return {
        platform: 'tiktokshop',
        status: 'error',
        message: 'TikTok Shop App Key not configured (still placeholder)',
        details: { appKey: process.env.TIKTOK_SHOP_APP_KEY }
      };
    }

    if (!process.env.TIKTOK_SHOP_APP_SECRET || process.env.TIKTOK_SHOP_APP_SECRET === 'your_app_secret_here') {
      return {
        platform: 'tiktokshop',
        status: 'error',
        message: 'TikTok Shop App Secret not configured (still placeholder)',
        details: { appSecret: process.env.TIKTOK_SHOP_APP_SECRET?.slice(0, 4) + '...' }
      };
    }

    // Test TikTok Shop Auth instance creation
    const credentials = {
      appKey: process.env.TIKTOK_SHOP_APP_KEY,
      appSecret: process.env.TIKTOK_SHOP_APP_SECRET,
      accessToken: '',
      refreshToken: ''
    };

    const config = {
      baseUrl: 'https://open-api.tiktokglobalshop.com',
      version: 'v1',
      timeout: 30000
    };

    const tiktokAuth = new TikTokShopAuth(credentials, config);
    
    // Test URL generation (this doesn't make API calls)
    const redirectUri = process.env.TIKTOK_SHOP_REDIRECT_URL || 'http://localhost:3000/api/platforms/tiktokshop/oauth/callback';
    const authUrl = tiktokAuth.generateAuthUrl(redirectUri, 'test-state');
    
    // Validate URL structure
    const urlObj = new URL(authUrl);
    const params = urlObj.searchParams;
    
    const hasRequiredParams = 
      params.has('app_key') &&
      params.has('state') &&
      params.has('redirect_uri') &&
      params.has('response_type');

    if (!hasRequiredParams) {
      return {
        platform: 'tiktokshop',
        status: 'error',
        message: 'Generated OAuth URL missing required parameters',
        details: { url: authUrl, params: Object.fromEntries(params) }
      };
    }

    // Test signature generation
    const testParams = { app_key: credentials.appKey, timestamp: '1234567890' };
    const signature = tiktokAuth.generateSignature('/test/path', testParams);
    
    if (!signature || signature.length !== 64) { // SHA256 hex is 64 chars
      return {
        platform: 'tiktokshop',
        status: 'error',
        message: 'Signature generation failed or invalid format',
        details: { signature, length: signature?.length }
      };
    }

    return {
      platform: 'tiktokshop',
      status: 'success',
      message: 'TikTok Shop OAuth configuration valid and URL generation working',
      details: {
        host: urlObj.host,
        appKey: params.get('app_key'),
        hasSignature: signature.length === 64,
        redirectUri
      }
    };

  } catch (error) {
    return {
      platform: 'tiktokshop',
      status: 'error',
      message: `TikTok Shop OAuth test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
}

/**
 * Run all authentication tests
 */
export async function runAllAuthTests(): Promise<AuthTestResult[]> {
  const results: AuthTestResult[] = [];
  
  console.log('🔐 Testing authentication configurations...\n');
  
  // Test Shopee
  console.log('Testing Shopee OAuth...');
  const shopeeResult = await testShopeeAuth();
  results.push(shopeeResult);
  console.log(`${shopeeResult.status === 'success' ? '✅' : '❌'} ${shopeeResult.message}\n`);
  
  // Test TikTok Shop
  console.log('Testing TikTok Shop OAuth...');
  const tiktokResult = await testTikTokShopAuth();
  results.push(tiktokResult);
  console.log(`${tiktokResult.status === 'success' ? '✅' : '❌'} ${tiktokResult.message}\n`);
  
  // Summary
  const successCount = results.filter(r => r.status === 'success').length;
  const totalCount = results.length;
  
  console.log(`📊 Authentication Test Summary: ${successCount}/${totalCount} passed`);
  
  if (successCount === totalCount) {
    console.log('🎉 All authentication tests passed!');
  } else {
    console.log('⚠️  Some authentication tests failed. Check credentials configuration.');
  }
  
  return results;
}