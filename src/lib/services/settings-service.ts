/**
 * Settings Service
 * Manages organization settings with encryption and audit logging
 */

import { db } from '@/lib/db';
import { 
  organizationSettings, 
  settingsAuditLog, 
  notificationSettings,
  systemNotifications,
  type InsertOrganizationSetting,
  type SelectOrganizationSetting,
  type InsertSettingsAuditLog,
  type InsertSystemNotification
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { EncryptionService, type EncryptedSetting, type SettingValue } from './encryption-service';

export interface SettingsAuditContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

export class SettingsService {
  /**
   * Get all settings for an organization
   */
  static async getSettings(organizationId: string): Promise<EncryptedSetting[]> {
    try {
      const settings = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .orderBy(organizationSettings.settingKey);

      return settings.map(setting => ({
        key: setting.settingKey,
        encryptedValue: setting.encryptedValue,
        isSensitive: setting.isSensitive,
        description: setting.description || undefined,
        lastTested: setting.lastTestedAt || undefined,
        testStatus: setting.testStatus as 'untested' | 'success' | 'failed',
        testError: setting.testError || undefined,
      }));
    } catch (error) {
      console.error('Failed to get settings:', error);
      throw new Error('Failed to retrieve settings');
    }
  }

  /**
   * Get a specific setting value (decrypted)
   */
  static async getSetting(
    organizationId: string, 
    key: string
  ): Promise<SettingValue | null> {
    try {
      const setting = await db
        .select()
        .from(organizationSettings)
        .where(
          and(
            eq(organizationSettings.organizationId, organizationId),
            eq(organizationSettings.settingKey, key)
          )
        )
        .limit(1);

      if (setting.length === 0) {
        return null;
      }

      const decryptedValue = setting[0].isSensitive
        ? EncryptionService.decrypt(setting[0].encryptedValue, organizationId)
        : setting[0].encryptedValue;

      return {
        key: setting[0].settingKey,
        value: decryptedValue,
        isSensitive: setting[0].isSensitive,
        description: setting[0].description || undefined,
      };
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      throw new Error(`Failed to retrieve setting: ${key}`);
    }
  }

  /**
   * Set a setting value (with encryption if sensitive)
   */
  static async setSetting(
    organizationId: string,
    key: string,
    value: string,
    options: {
      isSensitive?: boolean;
      description?: string;
      auditContext: SettingsAuditContext;
    }
  ): Promise<void> {
    const { isSensitive = true, description, auditContext } = options;

    try {
      // Get old value for audit log
      const oldSetting = await this.getSetting(organizationId, key);
      const oldValueHash = oldSetting 
        ? EncryptionService.createHash(oldSetting.value)
        : null;

      // Encrypt value if sensitive
      const encryptedValue = isSensitive
        ? EncryptionService.encrypt(value, organizationId)
        : value;

      const newValueHash = EncryptionService.createHash(value);

      // Upsert setting
      await db
        .insert(organizationSettings)
        .values({
          organizationId,
          settingKey: key,
          encryptedValue,
          isSensitive,
          description,
          testStatus: 'untested',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [organizationSettings.organizationId, organizationSettings.settingKey],
          set: {
            encryptedValue,
            isSensitive,
            description,
            testStatus: 'untested',
            testError: null,
            updatedAt: new Date(),
          },
        });

      // Log the change
      await this.logAudit({
        organizationId,
        userId: auditContext.userId,
        action: oldSetting ? 'update' : 'create',
        settingKey: key,
        oldValueHash,
        newValueHash,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
      });

      // Create notification for sensitive settings
      if (isSensitive) {
        await this.createNotification({
          organizationId,
          userId: auditContext.userId,
          type: 'info',
          category: 'security',
          title: 'API Configuration Updated',
          message: `${key} has been ${oldSetting ? 'updated' : 'configured'}`,
          metadata: { settingKey: key, action: oldSetting ? 'update' : 'create' },
        });
      }

    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      
      // Log failed attempt
      await this.logAudit({
        organizationId,
        userId: auditContext.userId,
        action: 'update',
        settingKey: key,
        oldValueHash: null,
        newValueHash: null,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`Failed to save setting: ${key}`);
    }
  }

  /**
   * Delete a setting
   */
  static async deleteSetting(
    organizationId: string,
    key: string,
    auditContext: SettingsAuditContext
  ): Promise<void> {
    try {
      // Get old value for audit log
      const oldSetting = await this.getSetting(organizationId, key);
      const oldValueHash = oldSetting 
        ? EncryptionService.createHash(oldSetting.value)
        : null;

      // Delete setting
      await db
        .delete(organizationSettings)
        .where(
          and(
            eq(organizationSettings.organizationId, organizationId),
            eq(organizationSettings.settingKey, key)
          )
        );

      // Log the deletion
      await this.logAudit({
        organizationId,
        userId: auditContext.userId,
        action: 'delete',
        settingKey: key,
        oldValueHash,
        newValueHash: null,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
      });

      // Create notification
      await this.createNotification({
        organizationId,
        userId: auditContext.userId,
        type: 'warning',
        category: 'security',
        title: 'API Configuration Removed',
        message: `${key} configuration has been removed`,
        metadata: { settingKey: key, action: 'delete' },
      });

    } catch (error) {
      console.error(`Failed to delete setting ${key}:`, error);
      throw new Error(`Failed to delete setting: ${key}`);
    }
  }

  /**
   * Test API connection for a specific setting
   */
  static async testConnection(
    organizationId: string,
    key: string,
    auditContext: SettingsAuditContext
  ): Promise<ConnectionTestResult> {
    try {
      const setting = await this.getSetting(organizationId, key);
      if (!setting) {
        throw new Error('Setting not found');
      }

      // Test connection based on setting type
      const testResult = await this.performConnectionTest(key, setting.value);

      // Update test status in database
      await db
        .update(organizationSettings)
        .set({
          lastTestedAt: new Date(),
          testStatus: testResult.success ? 'success' : 'failed',
          testError: testResult.success ? null : testResult.message,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationSettings.organizationId, organizationId),
            eq(organizationSettings.settingKey, key)
          )
        );

      // Log the test
      await this.logAudit({
        organizationId,
        userId: auditContext.userId,
        action: 'test',
        settingKey: key,
        oldValueHash: null,
        newValueHash: null,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: testResult.success,
        errorMessage: testResult.success ? null : testResult.message,
      });

      // Create notification if test failed
      if (!testResult.success) {
        await this.createNotification({
          organizationId,
          type: 'error',
          category: 'api_connection',
          title: 'API Connection Test Failed',
          message: `Connection test for ${key} failed: ${testResult.message}`,
          metadata: { settingKey: key, error: testResult.message },
        });
      }

      return testResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        message: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Perform actual connection test based on setting type
   */
  private static async performConnectionTest(
    key: string, 
    value: string
  ): Promise<ConnectionTestResult> {
    const timestamp = new Date();

    try {
      // Parse the setting value (could be JSON for complex configs)
      let config: any;
      try {
        config = JSON.parse(value);
      } catch {
        config = { apiKey: value }; // Simple string value
      }

      switch (key) {
        case 'shopee_api_config':
          return await this.testShopeeConnection(config);
        
        case 'tiktokshop_api_config':
          return await this.testTikTokShopConnection(config);
        
        case 'sentry_dsn':
          return await this.testSentryConnection(config);
        
        case 'redis_url':
          return await this.testRedisConnection(config);
        
        default:
          return {
            success: true,
            message: 'Configuration saved (no connection test available)',
            timestamp,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        timestamp,
      };
    }
  }

  /**
   * Test Shopee API connection
   */
  private static async testShopeeConnection(config: any): Promise<ConnectionTestResult> {
    // This would be implemented with actual Shopee API calls
    // For now, just validate the config structure
    const requiredFields = ['appKey', 'appSecret', 'partnerId'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      return {
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        timestamp: new Date(),
      };
    }

    // TODO: Implement actual API test call
    return {
      success: true,
      message: 'Shopee API configuration is valid',
      timestamp: new Date(),
    };
  }

  /**
   * Test TikTok Shop API connection
   */
  private static async testTikTokShopConnection(config: any): Promise<ConnectionTestResult> {
    // Similar to Shopee, validate config structure
    const requiredFields = ['appKey', 'appSecret'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      return {
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        timestamp: new Date(),
      };
    }

    // TODO: Implement actual API test call
    return {
      success: true,
      message: 'TikTok Shop API configuration is valid',
      timestamp: new Date(),
    };
  }

  /**
   * Test Sentry connection
   */
  private static async testSentryConnection(config: any): Promise<ConnectionTestResult> {
    const dsn = typeof config === 'string' ? config : config.dsn;
    
    if (!dsn || !dsn.startsWith('https://')) {
      return {
        success: false,
        message: 'Invalid Sentry DSN format',
        timestamp: new Date(),
      };
    }

    // TODO: Test actual Sentry connection
    return {
      success: true,
      message: 'Sentry DSN is valid',
      timestamp: new Date(),
    };
  }

  /**
   * Test Redis connection
   */
  private static async testRedisConnection(config: any): Promise<ConnectionTestResult> {
    const url = typeof config === 'string' ? config : config.url;
    
    if (!url) {
      return {
        success: false,
        message: 'Redis URL is required',
        timestamp: new Date(),
      };
    }

    // TODO: Test actual Redis connection
    return {
      success: true,
      message: 'Redis configuration is valid',
      timestamp: new Date(),
    };
  }

  /**
   * Get audit log for settings
   */
  static async getAuditLog(
    organizationId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      return await db
        .select()
        .from(settingsAuditLog)
        .where(eq(settingsAuditLog.organizationId, organizationId))
        .orderBy(desc(settingsAuditLog.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Failed to get audit log:', error);
      throw new Error('Failed to retrieve audit log');
    }
  }

  /**
   * Log audit entry
   */
  private static async logAudit(entry: Omit<InsertSettingsAuditLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      await db.insert(settingsAuditLog).values({
        ...entry,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  /**
   * Create system notification
   */
  private static async createNotification(
    notification: Omit<InsertSystemNotification, 'id' | 'createdAt'>
  ): Promise<void> {
    try {
      await db.insert(systemNotifications).values({
        ...notification,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  /**
   * Get masked settings for display
   */
  static async getMaskedSettings(organizationId: string): Promise<any[]> {
    const settings = await this.getSettings(organizationId);
    
    return settings.map(setting => ({
      key: setting.key,
      value: setting.isSensitive 
        ? EncryptionService.maskValue(setting.encryptedValue)
        : setting.encryptedValue,
      isSensitive: setting.isSensitive,
      description: setting.description,
      lastTested: setting.lastTested,
      testStatus: setting.testStatus,
      testError: setting.testError,
    }));
  }
}