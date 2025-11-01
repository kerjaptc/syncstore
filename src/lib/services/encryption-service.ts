/**
 * Encryption Service for Sensitive Data
 * Handles encryption/decryption of API keys and other sensitive information
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { env } from '@/env';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  /**
   * Get encryption key from environment
   */
  private static getEncryptionKey(): Buffer {
    const key = env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
    
    // Use first 32 bytes of the key
    return Buffer.from(key.slice(0, 32), 'utf8');
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(plaintext: string, organizationId?: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = randomBytes(this.IV_LENGTH);
      
      // Add organization ID to the data for additional security
      const dataToEncrypt = organizationId 
        ? `${organizationId}:${plaintext}` 
        : plaintext;
      
      const cipher = createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(dataToEncrypt, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV + encrypted data + auth tag
      const combined = iv.toString('hex') + encrypted + tag.toString('hex');
      
      return combined;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string, organizationId?: string): string {
    try {
      const key = this.getEncryptionKey();
      
      // Extract IV, encrypted data, and auth tag
      const iv = Buffer.from(encryptedData.slice(0, this.IV_LENGTH * 2), 'hex');
      const tag = Buffer.from(encryptedData.slice(-this.TAG_LENGTH * 2), 'hex');
      const encrypted = encryptedData.slice(this.IV_LENGTH * 2, -this.TAG_LENGTH * 2);
      
      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Remove organization ID if it was added during encryption
      if (organizationId && decrypted.startsWith(`${organizationId}:`)) {
        return decrypted.slice(organizationId.length + 1);
      }
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Create hash for audit logging (one-way)
   */
  static createHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Mask sensitive data for display
   */
  static maskValue(value: string, visibleChars: number = 4): string {
    if (!value || value.length <= visibleChars) {
      return '••••••••';
    }
    
    const masked = '•'.repeat(Math.max(8, value.length - visibleChars));
    const visible = value.slice(-visibleChars);
    
    return `${masked}${visible}`;
  }

  /**
   * Validate if a string is encrypted (basic check)
   */
  static isEncrypted(data: string): boolean {
    // Check if it looks like hex-encoded encrypted data
    const hexPattern = /^[0-9a-f]+$/i;
    const minLength = (this.IV_LENGTH + this.TAG_LENGTH) * 2 + 16; // IV + tag + some data
    
    return hexPattern.test(data) && data.length >= minLength;
  }

  /**
   * Generate secure random string for tokens/secrets
   */
  static generateSecureRandom(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Validate encryption key strength
   */
  static validateEncryptionKey(key: string): { valid: boolean; message: string } {
    if (!key) {
      return { valid: false, message: 'Encryption key is required' };
    }
    
    if (key.length < 32) {
      return { valid: false, message: 'Encryption key must be at least 32 characters' };
    }
    
    // Check for common weak patterns
    if (key === key.toLowerCase() || key === key.toUpperCase()) {
      return { valid: false, message: 'Encryption key should contain mixed case characters' };
    }
    
    if (!/\d/.test(key)) {
      return { valid: false, message: 'Encryption key should contain numbers' };
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(key)) {
      return { valid: false, message: 'Encryption key should contain special characters' };
    }
    
    return { valid: true, message: 'Encryption key is strong' };
  }

  /**
   * Test encryption/decryption functionality
   */
  static testEncryption(): { success: boolean; error?: string } {
    try {
      const testData = 'test-encryption-' + Date.now();
      const orgId = 'test-org-123';
      
      const encrypted = this.encrypt(testData, orgId);
      const decrypted = this.decrypt(encrypted, orgId);
      
      if (decrypted !== testData) {
        return { success: false, error: 'Decrypted data does not match original' };
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown encryption test error' 
      };
    }
  }
}

// Export types for use in other modules
export interface EncryptedSetting {
  key: string;
  encryptedValue: string;
  isSensitive: boolean;
  description?: string;
  lastTested?: Date;
  testStatus: 'untested' | 'success' | 'failed';
  testError?: string;
}

export interface SettingValue {
  key: string;
  value: string;
  isSensitive: boolean;
  description?: string;
}

export interface EncryptionTestResult {
  success: boolean;
  error?: string;
  timestamp: Date;
}