#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const testConnection = async () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }
  
  console.log('🔄 Testing database connection...');
  
  const connection = postgres(connectionString, { max: 1 });
  const db = drizzle(connection);
  
  try {
    // Test basic connection
    const result = await connection`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    console.log('Test query result:', result);
    
    // Check if tables exist
    const tables = await connection`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log('📋 Existing tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

testConnection();