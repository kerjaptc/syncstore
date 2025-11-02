#!/usr/bin/env tsx

/**
 * Test single API endpoint to debug response
 */

async function testAPI() {
  try {
    console.log('Testing /api/products/phase4...');
    
    const response = await fetch('http://localhost:3000/api/products/phase4?limit=2');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && Array.isArray(data.data)) {
      console.log('Products found:', data.data.length);
      console.log('First product ID:', data.data[0]?.id);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();