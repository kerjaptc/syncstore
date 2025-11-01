#!/usr/bin/env node

const { EncryptionService } = require('../src/lib/services/encryption-service.ts');

console.log('🧪 Testing Admin Settings System...');

// Test encryption functionality
console.log('\n1. Testing Encryption Service...');
try {
  const testResult = EncryptionService.testEncryption();
  if (testResult.success) {
    console.log('✅ Encryption test passed');
  } else {
    console.log('❌ Encryption test failed:', testResult.error);
  }
} catch (error) {
  console.log('❌ Encryption service error:', error.message);
}

// Test masking functionality
console.log('\n2. Testing Data Masking...');
try {
  const testKey = 'sk_test_1234567890abcdef';
  const masked = EncryptionService.maskValue(testKey);
  console.log('✅ Original:', testKey);
  console.log('✅ Masked:', masked);
} catch (error) {
  console.log('❌ Masking error:', error.message);
}

// Test key validation
console.log('\n3. Testing Key Validation...');
try {
  const weakKey = 'password123';
  const strongKey = 'MyStr0ng!Encrypt10nK3y#2024$SecureApp';
  
  const weakResult = EncryptionService.validateEncryptionKey(weakKey);
  const strongResult = EncryptionService.validateEncryptionKey(strongKey);
  
  console.log('✅ Weak key validation:', weakResult.message);
  console.log('✅ Strong key validation:', strongResult.message);
} catch (error) {
  console.log('❌ Key validation error:', error.message);
}

console.log('\n🎉 Admin Settings System tests completed!');
console.log('\n📋 Next Steps:');
console.log('1. Set up your environment variables (.env file)');
console.log('2. Configure Clerk authentication');
console.log('3. Access /admin/settings as an admin user');
console.log('4. Configure your marketplace API keys');