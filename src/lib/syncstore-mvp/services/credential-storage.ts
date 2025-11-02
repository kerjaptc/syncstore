/**
 * SyncStore MVP Credential Storage Service
 * 
 * This service handles secure storage and encryption of OAuth credentials
 * and other sensitive data for store connections.
 */

import crypto from 'crypto';
import {
  ValidationError,
  ConfigurationError,
  createErrorContext,
  validateData,
} from '../index';
import { z } from 'zod';

// ============================================================================
// Configuration and Types
// ============================================================================

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  iterations: number;
  saltLength: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
}

export interface StoredCredentials {
  accessToken: EncryptedData;
  refreshToken: EncryptedData;
  expiresAt: Date;
  encryptedAt: Date;
}

const EncryptedDataSchema = z.object({
  encrypted: z.string().min(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
  salt: z.string().min(1),
});

const StoredCredentialsSchema = z.object({
  accessToken: EncryptedDataSchema,
  refreshToken: EncryptedDataSchema,
  expiresAt: z.date(),
  encryptedAt: z.date(),
});

// ============================================================================
// Encryption Service
// ============================================================================

export class CredentialEncryptionService {
  private config: EncryptionConfig;
  private masterKey: Buffer;

  constructor(masterKey: string, config?: Partial<EncryptionConfig>) {
    if (!masterKey) {
      throw new ConfigurationError('Master key is required for credential encryption', 'masterKey');
    }

    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      tagLength: 16,
      iterations: 100000,
      saltLength: 32,
      ...config,
    };

    // Derive master key using PBKDF2
    this.masterKey = crypto.pbkdf2Sync(
      masterKey,
      'syncstore-credential-salt',
      this.config.iterations,
      this.config.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypts sensitive data using AES-256-GCM
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      if (!plaintext) {
        throw new ValidationError('Plaintext is required for encryption', 'plaintext');
      }

      // Generate random salt and IV
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);

      // Derive encryption key from master key and salt
      const key = crypto.pbkdf2Sync(
        this.masterKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );

      // Create cipher
      const cipher = crypto.createCipher(this.config.algorithm, key);
      cipher.setAAD(salt); // Use salt as additional authenticated data

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex'),
      };

    } catch (error) {
      const context = createErrorContext('encrypt', { plaintextLength: plaintext?.length });
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts data encrypted with encrypt method
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      // Validate input
      validateData(EncryptedDataSchema, encryptedData, 'EncryptedData');

      // Convert hex strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      // Derive decryption key
      const key = crypto.pbkdf2Sync(
        this.masterKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );

      // Create decipher
      const decipher = crypto.createDecipher(this.config.algorithm, key);
      decipher.setAAD(salt);
      decipher.setAuthTag(tag);

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      const context = createErrorContext('decrypt', { 
        hasEncrypted: !!encryptedData?.encrypted,
        hasIv: !!encryptedData?.iv,
        hasTag: !!encryptedData?.tag,
        hasSalt: !!encryptedData?.salt,
      });
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypts OAuth credentials for storage
   */
  encryptCredentials(accessToken: string, refreshToken: string, expiresAt: Date): StoredCredentials {
    try {
      if (!accessToken) {
        throw new ValidationError('Access token is required', 'accessToken');
      }
      if (!refreshToken) {
        throw new ValidationError('Refresh token is required', 'refreshToken');
      }
      if (!expiresAt) {
        throw new ValidationError('Expiration date is required', 'expiresAt');
      }

      return {
        accessToken: this.encrypt(accessToken),
        refreshToken: this.encrypt(refreshToken),
        expiresAt,
        encryptedAt: new Date(),
      };

    } catch (error) {
      const context = createErrorContext('encryptCredentials', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiresAt: expiresAt?.toISOString(),
      });
      throw new Error(`Credential encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts stored credentials
   */
  decryptCredentials(storedCredentials: StoredCredentials): {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  } {
    try {
      // Validate input
      validateData(StoredCredentialsSchema, storedCredentials, 'StoredCredentials');

      return {
        accessToken: this.decrypt(storedCredentials.accessToken),
        refreshToken: this.decrypt(storedCredentials.refreshToken),
        expiresAt: storedCredentials.expiresAt,
      };

    } catch (error) {
      const context = createErrorContext('decryptCredentials', {
        encryptedAt: storedCredentials?.encryptedAt?.toISOString(),
        expiresAt: storedCredentials?.expiresAt?.toISOString(),
      });
      throw new Error(`Credential decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if credentials are expired
   */
  areCredentialsExpired(storedCredentials: StoredCredentials): boolean {
    return storedCredentials.expiresAt <= new Date();
  }

  /**
   * Checks if credentials will expire within the specified minutes
   */
  willCredentialsExpireSoon(storedCredentials: StoredCredentials, withinMinutes: number = 30): boolean {
    const expirationThreshold = new Date(Date.now() + withinMinutes * 60 * 1000);
    return storedCredentials.expiresAt <= expirationThreshold;
  }

  /**
   * Rotates encryption by re-encrypting with new salt/IV
   */
  rotateEncryption(storedCredentials: StoredCredentials): StoredCredentials {
    try {
      // Decrypt current credentials
      const decrypted = this.decryptCredentials(storedCredentials);
      
      // Re-encrypt with new salt/IV
      return this.encryptCredentials(
        decrypted.accessToken,
        decrypted.refreshToken,
        decrypted.expiresAt
      );

    } catch (error) {
      const context = createErrorContext('rotateEncryption', {
        encryptedAt: storedCredentials?.encryptedAt?.toISOString(),
      });
      throw new Error(`Encryption rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ============================================================================
// Credential Storage Service
// ============================================================================

export class CredentialStorageService {
  private encryptionService: CredentialEncryptionService;
  private credentialCache = new Map<string, { credentials: StoredCredentials; cachedAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(masterKey: string, encryptionConfig?: Partial<EncryptionConfig>) {
    this.encryptionService = new CredentialEncryptionService(masterKey, encryptionConfig);
  }

  /**
   * Stores encrypted credentials (in-memory for now, will be database in next task)
   */
  async storeCredentials(
    storeId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      const encryptedCredentials = this.encryptionService.encryptCredentials(
        accessToken,
        refreshToken,
        expiresAt
      );

      // Store in cache (temporary - will be database in next task)
      this.credentialCache.set(storeId, {
        credentials: encryptedCredentials,
        cachedAt: Date.now(),
      });

    } catch (error) {
      const context = createErrorContext('storeCredentials', { storeId });
      throw new Error(`Failed to store credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves and decrypts credentials
   */
  async getCredentials(storeId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  } | null> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      // Get from cache (temporary - will be database in next task)
      const cached = this.credentialCache.get(storeId);
      if (!cached) {
        return null;
      }

      // Check cache TTL
      if (Date.now() - cached.cachedAt > this.CACHE_TTL) {
        this.credentialCache.delete(storeId);
        return null;
      }

      return this.encryptionService.decryptCredentials(cached.credentials);

    } catch (error) {
      const context = createErrorContext('getCredentials', { storeId });
      throw new Error(`Failed to retrieve credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates stored credentials
   */
  async updateCredentials(
    storeId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    // For now, this is the same as store (will be different with database)
    return this.storeCredentials(storeId, accessToken, refreshToken, expiresAt);
  }

  /**
   * Removes stored credentials
   */
  async removeCredentials(storeId: string): Promise<void> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }

      // Remove from cache (temporary - will be database in next task)
      this.credentialCache.delete(storeId);

    } catch (error) {
      const context = createErrorContext('removeCredentials', { storeId });
      throw new Error(`Failed to remove credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if credentials exist for a store
   */
  async hasCredentials(storeId: string): Promise<boolean> {
    try {
      const credentials = await this.getCredentials(storeId);
      return credentials !== null;
    } catch {
      return false;
    }
  }

  /**
   * Checks if stored credentials are expired
   */
  async areCredentialsExpired(storeId: string): Promise<boolean> {
    try {
      const credentials = await this.getCredentials(storeId);
      if (!credentials) {
        return true;
      }
      return credentials.expiresAt <= new Date();
    } catch {
      return true;
    }
  }

  /**
   * Lists all store IDs with stored credentials (for maintenance)
   */
  async listStoredCredentials(): Promise<string[]> {
    // Return cache keys (temporary - will be database query in next task)
    return Array.from(this.credentialCache.keys());
  }

  /**
   * Clears expired credentials from storage
   */
  async cleanupExpiredCredentials(): Promise<number> {
    let cleanedCount = 0;
    
    for (const storeId of await this.listStoredCredentials()) {
      if (await this.areCredentialsExpired(storeId)) {
        await this.removeCredentials(storeId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates CredentialStorageService from environment variables
 */
export function createCredentialStorageService(): CredentialStorageService {
  const masterKey = process.env.CREDENTIAL_MASTER_KEY;
  if (!masterKey) {
    throw new ConfigurationError(
      'CREDENTIAL_MASTER_KEY environment variable is required',
      'CREDENTIAL_MASTER_KEY'
    );
  }

  return new CredentialStorageService(masterKey);
}

/**
 * Generates a secure master key for credential encryption
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates master key strength
 */
export function validateMasterKey(key: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!key) {
    errors.push('Master key is required');
  } else {
    if (key.length < 32) {
      errors.push('Master key must be at least 32 characters long');
    }
    if (!/^[a-fA-F0-9]+$/.test(key) && key.length % 2 === 0) {
      // If it looks like hex, validate hex format
      if (key.length < 64) {
        errors.push('Hex master key must be at least 64 characters (32 bytes)');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}