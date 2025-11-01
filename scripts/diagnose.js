#!/usr/bin/env node

/**
 * Quick Diagnosis Script
 * Checks common issues and provides solutions
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value;
        }
      }
    });
    console.log('📁 Loaded environment variables from .env.local');
  } else {
    console.log('⚠️  No .env.local file found');
  }
}

// Load environment variables first
loadEnvFile();

console.log('🔍 StoreSync Diagnosis Tool');
console.log('='.repeat(50));

// Check Node.js version
console.log(`📦 Node.js: ${process.version}`);

// Check environment variables
console.log('\n🔑 Environment Variables:');
const requiredEnvs = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'DATABASE_URL',
  'ENCRYPTION_KEY'
];

const optionalEnvs = [
  'SHOPEE_PARTNER_ID',
  'TIKTOK_SHOP_APP_KEY',
  'SENTRY_DSN',
  'REDIS_URL'
];

let missingRequired = [];
let missingOptional = [];

requiredEnvs.forEach(env => {
  const value = process.env[env];
  if (value) {
    console.log(`✅ ${env}: Set (${value.substring(0, 10)}...)`);
  } else {
    console.log(`❌ ${env}: Missing`);
    missingRequired.push(env);
  }
});

optionalEnvs.forEach(env => {
  const value = process.env[env];
  if (value) {
    console.log(`✅ ${env}: Set (${value.substring(0, 10)}...)`);
  } else {
    console.log(`⚠️  ${env}: Not set (optional)`);
    missingOptional.push(env);
  }
});

// Check memory usage
console.log('\n📊 Memory Usage:');
const memUsage = process.memoryUsage();
const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
console.log(`Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`);
console.log(`Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`);
console.log(`Memory Usage: ${Math.round(memoryPercentage)}%`);

if (memoryPercentage > 80) {
  console.log('🚨 HIGH MEMORY USAGE - Use: npm run dev:light');
} else if (memoryPercentage > 60) {
  console.log('⚠️  Moderate memory usage - Monitor closely');
} else {
  console.log('✅ Memory usage is healthy');
}

// Provide recommendations
console.log('\n🎯 Recommendations:');

if (missingRequired.length > 0) {
  console.log('🚨 CRITICAL - Missing required environment variables:');
  missingRequired.forEach(env => {
    console.log(`   - ${env}`);
  });
  console.log('   Create .env.local file with these variables');
}

if (memoryPercentage > 70) {
  console.log('⚡ Use optimized development mode:');
  console.log('   npm run dev:light');
}

if (missingOptional.length > 0) {
  console.log('💡 For full functionality, consider adding:');
  missingOptional.forEach(env => {
    console.log(`   - ${env}`);
  });
}

// Quick fixes
console.log('\n🚀 Quick Fixes:');
console.log('1. Restart with optimizations: npm run dev:light');
console.log('2. Check memory usage: npm run memory:check');
console.log('3. Clear cache: rm -rf .next && npm run dev');
console.log('4. Database studio: npm run db:studio');

// Status summary
console.log('\n📋 Status Summary:');
if (missingRequired.length === 0) {
  console.log('✅ All required environment variables are set');
  console.log('✅ Ready for development');

  if (memoryPercentage < 70) {
    console.log('✅ Memory usage is optimal');
    console.log('🎉 System is ready for API key input!');
  } else {
    console.log('⚠️  Consider using npm run dev:light for better performance');
  }
} else {
  console.log('❌ Missing critical environment variables');
  console.log('🔧 Set up .env.local file before proceeding');
}

console.log('\n' + '='.repeat(50));
console.log('For detailed troubleshooting: see TROUBLESHOOTING.md');