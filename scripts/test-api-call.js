// Simple script to test API endpoints
const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🔍 Testing API endpoints...');
    
    // Test the simple products endpoint
    const response = await fetch('http://localhost:3000/api/test/simple-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Response status:', response.status);
    const result = await response.text();
    console.log('Response:', result);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();