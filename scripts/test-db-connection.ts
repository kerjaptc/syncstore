#!/usr/bin/env tsx

/**
 * Simple Database Connection Test
 * Tests basic database connectivity without complex operations
 */

import postgres from 'postgres';

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  console.log(`📡 Connecting to: ${DATABASE_URL.replace(/:[^:@]*@/, ':***@')}`);
  
  try {
    // Create postgres client
    const sql = postgres(DATABASE_URL, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10
    });
    
    // Test simple query
    const result = await sql`SELECT 1 as test, NOW() as timestamp`;
    
    console.log('✅ Database connection successful!');
    console.log(`📊 Test result:`, result[0]);
    
    // Test if organizations table exists
    try {
      const orgCheck = await sql`SELECT COUNT(*) as count FROM organizations`;
      console.log(`📋 Organizations table exists with ${orgCheck[0].count} records`);
    } catch (error) {
      console.log('⚠️  Organizations table may not exist:', error.message);
    }
    
    // Close connection
    await sql.end();
    
    console.log('🎉 Database test completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();