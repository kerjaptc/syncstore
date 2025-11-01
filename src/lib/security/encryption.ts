/**
 * Encryption Service
 * Handles encryption and decryption of sensitive data using AES-256
 */

import CryptoJS from 'crypto-js';
import { env } from '@/env';

export class EncryptionService {
  private readonly algorithm = 'AES';
  private readonly keySize = 256;
  private readonly ivSize = 128;
  private readonly iterations = 1000;

  /**
   * Generate a key derivation from the master key and organization ID
   */
  private deriveKey(organizationId: string): string {
    const salt = CryptoJS.SHA256(organizationId).toString();
    const key = CryptoJS.PBKDF2(env.ENCRYPTION_KEY, salt, {
      keySize: this.keySize / 32,
      iterations: this.iterations,
    });
    return key.toString();
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  async encrypt(data: string, organizationId: string): Promise<string> {
    try {
      const key = this.deriveKey(organizationId);
      const iv = CryptoJS.lib.WordArray.random(this.ivSize / 8);
      
      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Combine IV and encrypted data
      const combined = iv.concat(encrypted.ciphertext);
      return combined.toString(CryptoJS.enc.Base64);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  async decrypt(encryptedData: string, organizationId: string): Promise<string> {
    try {
      const key = this.deriveKey(organizationId);
      const combined = CryptoJS.enc.Base64.parse(encryptedData);
      
      // Extract IV and ciphertext
      const iv = CryptoJS.lib.WordArray.create(
        combined.words.slice(0, this.ivSize / 32)
      );
      const ciphertext = CryptoJS.lib.WordArray.create(
        combined.words.slice(this.ivSize / 32)
      );

      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext } as any,
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Verify if data matches a hash
   */
  verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }

  /**
   * Encrypt credentials for API storage
   */
  async encryptCredentials(
    credentials: Record<string, any>,
    organizationId: string
  ): Promise<string> {
    // Remove sensitive fields from logs
    const sanitizedCredentials = { ...credentials };
    Object.keys(sanitizedCredentials).forEach(key => {
      if (key.toLowerCase().includes('secret') || 
          key.toLowerCase().includes('key') || 
          key.toLowerCase().includes('password')) {
        sanitizedCredentials[key] = '[ENCRYPTED]';
      }
    });

    console.log('Encrypting credentials for organization:', organizationId, sanitizedCredentials);
    
    return this.encrypt(JSON.stringify(credentials), organizationId);
  }

  /**
   * Decrypt credentials from API storage
   */
  async decryptCredentials(
    encryptedCredentials: string,
    organizationId: string
  ): Promise<Record<string, any>> {
    const decryptedString = await this.decrypt(encryptedCredentials, organizationId);
    return JSON.parse(decryptedString);
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: Record<string, any>): Record<string, any> {
    const masked = { ...data };
    const sensitiveKeys = [
      'password', 'secret', 'key', 'token', 'credential',
      'partner_key', 'app_secret', 'access_token', 'refresh_token'
    ];

    Object.keys(masked).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        const value = masked[key];
        if (typeof value === 'string' && value.length > 4) {
          masked[key] = value.substring(0, 4) + '*'.repeat(value.length - 4);
        } else {
          masked[key] = '[MASKED]';
        }
      }
    });

    return masked;
  }

  /**
   * Validate encryption key strength
   */
  validateEncryptionKey(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const key = env.ENCRYPTION_KEY;

    if (!key) {
      errors.push('Encryption key is not set');
      return { isValid: false, errors };
    }

    if (key.length < 32) {
      errors.push('Encryption key must be at least 32 characters long');
    }

    if (!/[A-Z]/.test(key)) {
      errors.push('Encryption key should contain uppercase letters');
    }

    if (!/[a-z]/.test(key)) {
      errors.push('Encryption key should contain lowercase letters');
    }

    if (!/[0-9]/.test(key)) {
      errors.push('Encryption key should contain numbers');
    }

    if (!/[^A-Za-z0-9]/.test(key)) {
      errors.push('Encryption key should contain special characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Rotate encryption key (for key rotation scenarios)
   */
  async rotateKey(
    oldEncryptedData: string,
    organizationId: string,
    newKey: string
  ): Promise<string> {
    // Decrypt with old key
    const decryptedData = await this.decrypt(oldEncryptedData, organizationId);
    
    // Temporarily use new key
    const originalKey = env.ENCRYPTION_KEY;
    (env as any).ENCRYPTION_KEY = newKey;
    
    try {
      // Encrypt with new key
      const reencryptedData = await this.encrypt(decryptedData, organizationId);
      return reencryptedData;
    } finally {
      // Restore original key
      (env as any).ENCRYPTION_KEY = originalKey;
    }
  }
}