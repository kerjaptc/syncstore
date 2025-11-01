#!/usr/bin/env node

/**
 * Clerk Fix Script
 * Helps resolve Clerk authentication timeout issues
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
  }
}

// Load environment variables first
loadEnvFile();

console.log('🔧 Clerk Authentication Fix Tool');
console.log('='.repeat(50));

// Check environment variables
console.log('1. Checking Clerk Environment Variables...');
const clerkPublicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (clerkPublicKey) {
  console.log(`✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${clerkPublicKey.substring(0, 20)}...`);
} else {
  console.log('❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Missing');
}

if (clerkSecretKey) {
  console.log(`✅ CLERK_SECRET_KEY: ${clerkSecretKey.substring(0, 20)}...`);
} else {
  console.log('❌ CLERK_SECRET_KEY: Missing');
}

// Check if keys are valid format
console.log('\n2. Validating Key Formats...');
if (clerkPublicKey) {
  if (clerkPublicKey.startsWith('pk_test_') || clerkPublicKey.startsWith('pk_live_')) {
    console.log('✅ Publishable key format is correct');
  } else {
    console.log('❌ Publishable key format is invalid (should start with pk_test_ or pk_live_)');
  }
}

if (clerkSecretKey) {
  if (clerkSecretKey.startsWith('sk_test_') || clerkSecretKey.startsWith('sk_live_')) {
    console.log('✅ Secret key format is correct');
  } else {
    console.log('❌ Secret key format is invalid (should start with sk_test_ or sk_live_)');
  }
}

// Check for common issues
console.log('\n3. Common Issues & Solutions:');

console.log('\n🔍 CLERK TIMEOUT SOLUTIONS:');
console.log('1. Clear browser cache and cookies');
console.log('2. Try incognito/private browsing mode');
console.log('3. Disable browser extensions temporarily');
console.log('4. Check network connectivity to clerk.com');
console.log('5. Restart development server completely');

console.log('\n🌐 NETWORK CONNECTIVITY TEST:');
console.log('Run this in terminal:');
console.log('curl -I https://clerk.com');
console.log('Should return: HTTP/2 200');

console.log('\n🔄 DEVELOPMENT SERVER RESTART:');
console.log('1. Stop current server (Ctrl+C)');
console.log('2. Clear Next.js cache: rm -rf .next');
console.log('3. Restart: npm run dev:light');

console.log('\n🍪 BROWSER CACHE CLEAR:');
console.log('Chrome/Edge: Ctrl+Shift+Delete');
console.log('Firefox: Ctrl+Shift+Delete');
console.log('Safari: Cmd+Option+E');

console.log('\n🔧 CLERK DASHBOARD CHECK:');
console.log('1. Go to https://dashboard.clerk.com');
console.log('2. Check if your application is active');
console.log('3. Verify domain settings include localhost:3000');
console.log('4. Check if API keys are still valid');

// Environment-specific recommendations
if (process.env.NODE_ENV === 'development') {
  console.log('\n💡 DEVELOPMENT MODE RECOMMENDATIONS:');
  console.log('- Use npm run dev:light for better performance');
  console.log('- Clear browser data regularly');
  console.log('- Restart server if Clerk issues persist');
}

console.log('\n🎯 IMMEDIATE ACTIONS:');
console.log('1. Clear browser cache completely');
console.log('2. Restart development server: npm run dev:light');
console.log('3. Try different browser or incognito mode');
console.log('4. Check Clerk dashboard for any issues');

console.log('\n' + '='.repeat(50));
console.log('If issues persist, check Clerk status: https://status.clerk.com');