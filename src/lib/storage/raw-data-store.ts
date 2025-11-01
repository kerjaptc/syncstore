/**
 * Raw Data Storage for Phase 1
 * Stores imported raw data for analysis and backup
 */

import { writeFile, readFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface RawDataEntry {
  id: string;
  platform: 'shopee' | 'tiktokshop';
  type: 'product' | 'variant';
  data: any;
  metadata: {
    importedAt: Date;
    source: string;
    version: string;
    organizationId?: string;
    storeId?: string;
  };
}

export interface StorageStats {
  totalEntries: number;
  entriesByPlatform: Record<string, number>;
  entriesByType: Record<string, number>;
  totalSizeBytes: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export class RawDataStore {
  private basePath: string;

  constructor(basePath = './data/raw-imports') {
    this.basePath = basePath;
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.basePath, { recursive: true });
      await mkdir(path.join(this.basePath, 'shopee'), { recursive: true });
      await mkdir(path.join(this.basePath, 'tiktokshop'), { recursive: true });
      await mkdir(path.join(this.basePath, 'backups'), { recursive: true });
      
      console.log(`📁 Raw data storage initialized at: ${this.basePath}`);
    } catch (error) {
      console.error('❌ Failed to initialize raw data storage:', error);
      throw error;
    }
  }

  /**
   * Store raw product data
   */
  async storeProduct(
    platform: 'shopee' | 'tiktokshop',
    productId: string,
    data: any,
    metadata: Partial<RawDataEntry['metadata']> = {}
  ): Promise<string> {
    const entry: RawDataEntry = {
      id: productId,
      platform,
      type: 'product',
      data,
      metadata: {
        importedAt: new Date(),
        source: `${platform}_api`,
        version: '1.0',
        ...metadata,
      },
    };

    const filename = `product_${productId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, platform, filename);

    try {
      await writeFile(filepath, JSON.stringify(entry, null, 2), 'utf8');
      console.log(`💾 Stored ${platform} product ${productId} to ${filename}`);
      return filepath;
    } catch (error) {
      console.error(`❌ Failed to store ${platform} product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Store raw variant data
   */
  async storeVariant(
    platform: 'shopee' | 'tiktokshop',
    productId: string,
    variantId: string,
    data: any,
    metadata: Partial<RawDataEntry['metadata']> = {}
  ): Promise<string> {
    const entry: RawDataEntry = {
      id: variantId,
      platform,
      type: 'variant',
      data,
      metadata: {
        importedAt: new Date(),
        source: `${platform}_api`,
        version: '1.0',
        ...metadata,
      },
    };

    const filename = `variant_${productId}_${variantId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, platform, filename);

    try {
      await writeFile(filepath, JSON.stringify(entry, null, 2), 'utf8');
      console.log(`💾 Stored ${platform} variant ${variantId} to ${filename}`);
      return filepath;
    } catch (error) {
      console.error(`❌ Failed to store ${platform} variant ${variantId}:`, error);
      throw error;
    }
  }

  /**
   * Store batch import data
   */
  async storeBatch(
    platform: 'shopee' | 'tiktokshop',
    batchId: string,
    products: any[],
    metadata: Partial<RawDataEntry['metadata']> = {}
  ): Promise<string> {
    const batchData = {
      batchId,
      platform,
      products,
      metadata: {
        importedAt: new Date(),
        source: `${platform}_api_batch`,
        version: '1.0',
        ...metadata,
      },
      stats: {
        totalProducts: products.length,
        productsWithVariants: products.filter(p => p.variants?.length > 0).length,
      },
    };

    const filename = `batch_${batchId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, platform, filename);

    try {
      await writeFile(filepath, JSON.stringify(batchData, null, 2), 'utf8');
      console.log(`💾 Stored ${platform} batch ${batchId} with ${products.length} products to ${filename}`);
      return filepath;
    } catch (error) {
      console.error(`❌ Failed to store ${platform} batch ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Store import session data
   */
  async storeImportSession(
    platform: 'shopee' | 'tiktokshop',
    sessionId: string,
    sessionData: {
      startTime: Date;
      endTime: Date;
      totalProducts: number;
      successCount: number;
      errorCount: number;
      errors: any[];
      configuration: any;
    }
  ): Promise<string> {
    const filename = `session_${sessionId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, platform, filename);

    try {
      await writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf8');
      console.log(`📊 Stored ${platform} import session ${sessionId} to ${filename}`);
      return filepath;
    } catch (error) {
      console.error(`❌ Failed to store ${platform} import session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Read stored data
   */
  async readEntry(filepath: string): Promise<RawDataEntry | null> {
    try {
      if (!existsSync(filepath)) {
        return null;
      }

      const content = await readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to read entry from ${filepath}:`, error);
      return null;
    }
  }

  /**
   * List stored files
   */
  async listFiles(
    platform?: 'shopee' | 'tiktokshop',
    type?: 'product' | 'variant' | 'batch' | 'session'
  ): Promise<string[]> {
    try {
      const searchPath = platform ? path.join(this.basePath, platform) : this.basePath;
      
      if (!existsSync(searchPath)) {
        return [];
      }

      const files = await readdir(searchPath);
      
      let filteredFiles = files.filter(file => file.endsWith('.json'));
      
      if (type) {
        filteredFiles = filteredFiles.filter(file => file.startsWith(type));
      }

      return filteredFiles.map(file => path.join(searchPath, file));
    } catch (error) {
      console.error('❌ Failed to list files:', error);
      return [];
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    const stats: StorageStats = {
      totalEntries: 0,
      entriesByPlatform: {},
      entriesByType: {},
      totalSizeBytes: 0,
    };

    try {
      const platforms = ['shopee', 'tiktokshop'];
      
      for (const platform of platforms) {
        const files = await this.listFiles(platform as any);
        stats.entriesByPlatform[platform] = files.length;
        stats.totalEntries += files.length;

        for (const filepath of files) {
          try {
            const fileStat = await stat(filepath);
            stats.totalSizeBytes += fileStat.size;

            // Determine type from filename
            const filename = path.basename(filepath);
            const type = filename.split('_')[0];
            stats.entriesByType[type] = (stats.entriesByType[type] || 0) + 1;

            // Track oldest and newest entries
            if (!stats.oldestEntry || fileStat.birthtime < stats.oldestEntry) {
              stats.oldestEntry = fileStat.birthtime;
            }
            if (!stats.newestEntry || fileStat.birthtime > stats.newestEntry) {
              stats.newestEntry = fileStat.birthtime;
            }
          } catch (error) {
            console.warn(`⚠️  Could not stat file ${filepath}:`, error);
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return stats;
    }
  }

  /**
   * Create backup of all data
   */
  async createBackup(backupName?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = backupName || `backup_${timestamp}`;
    const backupPath = path.join(this.basePath, 'backups', name);

    try {
      await mkdir(backupPath, { recursive: true });

      const platforms = ['shopee', 'tiktokshop'];
      let totalFiles = 0;

      for (const platform of platforms) {
        const platformPath = path.join(this.basePath, platform);
        const backupPlatformPath = path.join(backupPath, platform);
        
        if (existsSync(platformPath)) {
          await mkdir(backupPlatformPath, { recursive: true });
          
          const files = await readdir(platformPath);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const sourcePath = path.join(platformPath, file);
              const destPath = path.join(backupPlatformPath, file);
              
              const content = await readFile(sourcePath);
              await writeFile(destPath, content);
              totalFiles++;
            }
          }
        }
      }

      // Create backup metadata
      const backupMetadata = {
        name,
        createdAt: new Date(),
        totalFiles,
        platforms: platforms,
        version: '1.0',
      };

      await writeFile(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(backupMetadata, null, 2)
      );

      console.log(`💾 Created backup '${name}' with ${totalFiles} files at ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error(`❌ Failed to create backup '${name}':`, error);
      throw error;
    }
  }

  /**
   * Clean up old files
   */
  async cleanup(olderThanDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;

    try {
      const platforms = ['shopee', 'tiktokshop'];
      
      for (const platform of platforms) {
        const files = await this.listFiles(platform as any);
        
        for (const filepath of files) {
          try {
            const fileStat = await stat(filepath);
            
            if (fileStat.birthtime < cutoffDate) {
              // Delete old file (in a real implementation, you'd use fs.unlink)
              console.log(`🗑️  Would delete old file: ${filepath}`);
              deletedCount++;
            }
          } catch (error) {
            console.warn(`⚠️  Could not check file ${filepath}:`, error);
          }
        }
      }

      console.log(`🧹 Cleanup completed: ${deletedCount} files marked for deletion`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old files:', error);
      return 0;
    }
  }

  /**
   * Generate storage report
   */
  async generateReport(): Promise<string> {
    const stats = await this.getStats();
    
    let report = `📊 Raw Data Storage Report\n`;
    report += `==========================\n\n`;
    report += `Total Entries: ${stats.totalEntries}\n`;
    report += `Total Size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB\n\n`;

    report += `Entries by Platform:\n`;
    Object.entries(stats.entriesByPlatform).forEach(([platform, count]) => {
      report += `  ${platform}: ${count}\n`;
    });

    report += `\nEntries by Type:\n`;
    Object.entries(stats.entriesByType).forEach(([type, count]) => {
      report += `  ${type}: ${count}\n`;
    });

    if (stats.oldestEntry && stats.newestEntry) {
      report += `\nDate Range:\n`;
      report += `  Oldest: ${stats.oldestEntry.toISOString()}\n`;
      report += `  Newest: ${stats.newestEntry.toISOString()}\n`;
    }

    return report;
  }
}

// Export singleton instance
export const rawDataStore = new RawDataStore();