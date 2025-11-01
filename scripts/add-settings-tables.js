#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const addSettingsTables = async () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }
  
  console.log('🔄 Adding settings tables...');
  
  const connection = postgres(connectionString, { max: 1 });
  
  try {
    // Create organization settings table for encrypted API keys
    await connection`
      CREATE TABLE IF NOT EXISTS organization_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        setting_key varchar(100) NOT NULL,
        encrypted_value text NOT NULL,
        is_sensitive boolean DEFAULT true NOT NULL,
        description text,
        last_tested_at timestamp with time zone,
        test_status varchar(20) DEFAULT 'untested', -- untested, success, failed
        test_error text,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(organization_id, setting_key)
      );
    `;
    console.log('✅ Organization settings table created');

    // Create settings audit log
    await connection`
      CREATE TABLE IF NOT EXISTS settings_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id text NOT NULL, -- Clerk user ID
        action varchar(50) NOT NULL, -- create, update, delete, view, test
        setting_key varchar(100) NOT NULL,
        old_value_hash varchar(64), -- SHA256 hash for comparison
        new_value_hash varchar(64),
        ip_address varchar(45),
        user_agent text,
        success boolean DEFAULT true,
        error_message text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ Settings audit log table created');

    // Create notification settings table
    await connection`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        notification_type varchar(50) NOT NULL, -- email, dashboard, slack
        is_enabled boolean DEFAULT true NOT NULL,
        configuration jsonb DEFAULT '{}',
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE(organization_id, notification_type)
      );
    `;
    console.log('✅ Notification settings table created');

    // Create system notifications table
    await connection`
      CREATE TABLE IF NOT EXISTS system_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id text, -- Clerk user ID (nullable for system-wide notifications)
        type varchar(50) NOT NULL, -- info, warning, error, success
        category varchar(50) NOT NULL, -- api_connection, sync_status, security, system
        title varchar(255) NOT NULL,
        message text NOT NULL,
        metadata jsonb DEFAULT '{}',
        is_read boolean DEFAULT false NOT NULL,
        expires_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✅ System notifications table created');

    // Add indexes for performance
    await connection`
      CREATE INDEX IF NOT EXISTS idx_organization_settings_org_key 
      ON organization_settings(organization_id, setting_key);
    `;
    
    await connection`
      CREATE INDEX IF NOT EXISTS idx_settings_audit_log_org_time 
      ON settings_audit_log(organization_id, created_at DESC);
    `;
    
    await connection`
      CREATE INDEX IF NOT EXISTS idx_system_notifications_user_unread 
      ON system_notifications(organization_id, user_id, is_read, created_at DESC);
    `;
    
    console.log('✅ Indexes created');

    // Insert default notification settings
    await connection`
      INSERT INTO notification_settings (organization_id, notification_type, configuration)
      SELECT 
        id as organization_id,
        'email' as notification_type,
        '{"enabled": true, "events": ["api_connection_failed", "sync_errors"]}' as configuration
      FROM organizations
      ON CONFLICT (organization_id, notification_type) DO NOTHING;
    `;

    await connection`
      INSERT INTO notification_settings (organization_id, notification_type, configuration)
      SELECT 
        id as organization_id,
        'dashboard' as notification_type,
        '{"enabled": true, "events": ["all"]}' as configuration
      FROM organizations
      ON CONFLICT (organization_id, notification_type) DO NOTHING;
    `;
    
    console.log('✅ Default notification settings created');
    console.log('🎉 Settings tables setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Settings tables setup failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

addSettingsTables();