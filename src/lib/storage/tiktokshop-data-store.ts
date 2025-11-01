/**
 * TikTok Shop Data Storage for Phase 1
 * Stores TikTok Shop imported data with Tokopedia flag tracking and progress logging
 */

import { writeFile, readFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface TikTokShopDataEntry {
  id: string;
  type: 'product' | 'variant' | 'batch' | 'session';
  data: any;
  metadata: {
    importedAt: Date;
    source: string;
    version: string;
    tokopediaEnabled?: boolean;
    organizationId?: string;
    storeId?: string;
    batchId?: string;
    sessionId?: string;
  };
}

export interface TikTokShopStorageStats {
  totalEntries: number;
  entriesByType: Record<string, number>;
  tokopediaEnabledCount: number;
  tokopediaDisabledCount: number;
  totalSizeBytes: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  averageProductSize: number;
}

export interface TikTokShopProgressLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: {
    productId?: string;
    batchId?: string;
    sessionId?: string;
    tokopediaFlag?: boolean;
    progress?: {
      current: number;
      total: number;
      percentage: number;
    };
  };
}

export class TikTokShopDataStore {
  private basePath: string;
  private progressLogs: TikTokShopProgressLog[] = [];

  constructor(basePath = './data/raw-imports/tiktokshop') {
    this.basePath = basePath;
  }

  /**
   * Initialize TikTok Shop storage directory
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.basePath, { recursive: true });
      await mkdir(path.join(this.basePath, 'products'), { recursive: true });
      await mkdir(path.join(this.basePath, 'variants'), { recursive: true });
      await mkdir(path.join(this.basePath, 'batches'), { recursive: true });
      await mkdir(path.join(this.basePath, 'sessions'), { recursive: true });
      await mkdir(path.join(this.basePath, 'logs'), { recursive: true });
      await mkdir(path.join(this.basePath, 'tokopedia'), { recursive: true });
      
      this.logProgress('info', `TikTok Shop data storage initialized at: ${this.basePath}`);
    } catch (error) {
      this.logProgress('error', `Failed to initialize TikTok Shop data storage: ${error}`);
      throw error;
    }
  }

  /**
   * Store TikTok Shop product data with Tokopedia flag tracking
   */
  async storeProduct(
    productId: string,
    data: any,
    metadata: Partial<TikTokShopDataEntry['metadata']> = {}
  ): Promise<string> {
    const tokopediaEnabled = data.include_tokopedia || false;
    
    const entry: TikTokShopDataEntry = {
      id: productId,
      type: 'product',
      data,
      metadata: {
        importedAt: new Date(),
        source: 'tiktokshop_api',
        version: '1.0',
        tokopediaEnabled,
        ...metadata,
      },
    };

    const filename = `product_${productId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, 'products', filename);

    try {
      await writeFile(filepath, JSON.stringify(entry, null, 2), 'utf8');
      
      this.logProgress('info', `Stored TikTok Shop product ${productId}`, {
        productId,
        tokopediaFlag: tokopediaEnabled,
      });

      // Also store in Tokopedia directory if flag is enabled
      if (tokopediaEnabled) {
        const tokopediaFilepath = path.join(this.basePath, 'tokopedia', filename);
        await writeFile(tokopediaFilepath, JSON.stringify(entry, null, 2), 'utf8');
        
        this.logProgress('info', `Product ${productId} also stored in Tokopedia directory`, {
          productId,
          tokopediaFlag: true,
        });
      }

      return filepath;
    } catch (error) {
      this.logProgress('error', `Failed to store TikTok Shop product ${productId}: ${error}`, {
        productId,
        tokopediaFlag: tokopediaEnabled,
      });
      throw error;
    }
  }

  /**
   * Store TikTok Shop variant data
   */
  async storeVariant(
    productId: string,
    variantId: string,
    data: any,
    metadata: Partial<TikTokShopDataEntry['metadata']> = {}
  ): Promise<string> {
    const entry: TikTokShopDataEntry = {
      id: variantId,
      type: 'variant',
      data,
      metadata: {
        importedAt: new Date(),
        source: 'tiktokshop_api',
        version: '1.0',
        ...metadata,
      },
    };

    const filename = `variant_${productId}_${variantId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, 'variants', filename);

    try {
      await writeFile(filepath, JSON.stringify(entry, null, 2), 'utf8');
      
      this.logProgress('info', `Stored TikTok Shop variant ${variantId} for product ${productId}`, {
        productId,
      });

      return filepath;
    } catch (error) {
      this.logProgress('error', `Failed to store TikTok Shop variant ${variantId}: ${error}`, {
        productId,
      });
      throw error;
    }
  }

  /**
   * Store batch import data with Tokopedia tracking
   */
  async storeBatch(
    batchId: string,
    products: any[],
    metadata: Partial<TikTokShopDataEntry['metadata']> = {}
  ): Promise<string> {
    const tokopediaEnabledProducts = products.filter(p => p.include_tokopedia || false);
    
    const batchData = {
      batchId,
      platform: 'tiktokshop',
      products,
      metadata: {
        importedAt: new Date(),
        source: 'tiktokshop_api_batch',
        version: '1.0',
        ...metadata,
      },
      stats: {
        totalProducts: products.length,
        productsWithVariants: products.filter(p => p.variants?.length > 0).length,
        tokopediaEnabledProducts: tokopediaEnabledProducts.length,
        tokopediaEnabledPercentage: Math.round((tokopediaEnabledProducts.length / products.length) * 100),
      },
    };

    const filename = `batch_${batchId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, 'batches', filename);

    try {
      await writeFile(filepath, JSON.stringify(batchData, null, 2), 'utf8');
      
      this.logProgress('info', `Stored TikTok Shop batch ${batchId} with ${products.length} products`, {
        batchId,
        progress: {
          current: products.length,
          total: products.length,
          percentage: 100,
        },
      });

      return filepath;
    } catch (error) {
      this.logProgress('error', `Failed to store TikTok Shop batch ${batchId}: ${error}`, {
        batchId,
      });
      throw error;
    }
  }

  /**
   * Store import session data with enhanced Tokopedia tracking
   */
  async storeImportSession(
    sessionId: string,
    sessionData: {
      startTime: Date;
      endTime: Date;
      totalProducts: number;
      successCount: number;
      errorCount: number;
      tokopediaEnabledCount: number;
      errors: any[];
      configuration: any;
    }
  ): Promise<string> {
    const enhancedSessionData = {
      ...sessionData,
      tokopediaStats: {
        enabledCount: sessionData.tokopediaEnabledCount,
        disabledCount: sessionData.totalProducts - sessionData.tokopediaEnabledCount,
        enabledPercentage: Math.round((sessionData.tokopediaEnabledCount / sessionData.totalProducts) * 100),
      },
      performance: {
        duration: sessionData.endTime.getTime() - sessionData.startTime.getTime(),
        productsPerSecond: sessionData.totalProducts / ((sessionData.endTime.getTime() - sessionData.startTime.getTime()) / 1000),
        successRate: Math.round((sessionData.successCount / sessionData.totalProducts) * 100),
      },
    };

    const filename = `session_${sessionId}_${Date.now()}.json`;
    const filepath = path.join(this.basePath, 'sessions', filename);

    try {
      await writeFile(filepath, JSON.stringify(enhancedSessionData, null, 2), 'utf8');
      
      this.logProgress('info', `Stored TikTok Shop import session ${sessionId}`, {
        sessionId,
        progress: {
          current: sessionData.successCount,
          total: sessionData.totalProducts,
          percentage: Math.round((sessionData.successCount / sessionData.totalProducts) * 100),
        },
      });

      return filepath;
    } catch (error) {
      this.logProgress('error', `Failed to store TikTok Shop import session ${sessionId}: ${error}`, {
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Log progress with context
   */
  logProgress(
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: TikTokShopProgressLog['context']
  ): void {
    const log: TikTokShopProgressLog = {
      timestamp: new Date(),
      level,
      message,
      context,
    };

    this.progressLogs.push(log);

    // Keep only last 1000 logs in memory
    if (this.progressLogs.length > 1000) {
      this.progressLogs = this.progressLogs.slice(-1000);
    }

    // Console output with appropriate level
    const timestamp = log.timestamp.toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    
    switch (level) {
      case 'info':
        console.log(`ℹ️  [${timestamp}] ${message}${contextStr}`);
        break;
      case 'warn':
        console.warn(`⚠️  [${timestamp}] ${message}${contextStr}`);
        break;
      case 'error':
        console.error(`❌ [${timestamp}] ${message}${contextStr}`);
        break;
    }
  }

  /**
   * Save progress logs to file
   */
  async saveProgressLogs(sessionId?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = sessionId 
      ? `progress_${sessionId}_${timestamp}.json`
      : `progress_${timestamp}.json`;
    const filepath = path.join(this.basePath, 'logs', filename);

    try {
      const logData = {
        sessionId,
        generatedAt: new Date(),
        totalLogs: this.progressLogs.length,
        logs: this.progressLogs,
        summary: {
          infoCount: this.progressLogs.filter(l => l.level === 'info').length,
          warnCount: this.progressLogs.filter(l => l.level === 'warn').length,
          errorCount: this.progressLogs.filter(l => l.level === 'error').length,
          tokopediaRelatedLogs: this.progressLogs.filter(l => l.context?.tokopediaFlag).length,
        },
      };

      await writeFile(filepath, JSON.stringify(logData, null, 2), 'utf8');
      
      this.logProgress('info', `Saved progress logs to ${filename}`, {
        sessionId,
      });

      return filepath;
    } catch (error) {
      this.logProgress('error', `Failed to save progress logs: ${error}`, {
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Get TikTok Shop storage statistics with Tokopedia breakdown
   */
  async getStats(): Promise<TikTokShopStorageStats> {
    const stats: TikTokShopStorageStats = {
      totalEntries: 0,
      entriesByType: {},
      tokopediaEnabledCount: 0,
      tokopediaDisabledCount: 0,
      totalSizeBytes: 0,
      averageProductSize: 0,
    };

    try {
      const types = ['products', 'variants', 'batches', 'sessions'];
      let totalProductSize = 0;
      let productCount = 0;
      
      for (const type of types) {
        const typePath = path.join(this.basePath, type);
        
        if (existsSync(typePath)) {
          const files = await readdir(typePath);
          const jsonFiles = files.filter(file => file.endsWith('.json'));
          
          stats.entriesByType[type] = jsonFiles.length;
          stats.totalEntries += jsonFiles.length;

          for (const file of jsonFiles) {
            try {
              const filepath = path.join(typePath, file);
              const fileStat = await stat(filepath);
              stats.totalSizeBytes += fileStat.size;

              // Track oldest and newest entries
              if (!stats.oldestEntry || fileStat.birthtime < stats.oldestEntry) {
                stats.oldestEntry = fileStat.birthtime;
              }
              if (!stats.newestEntry || fileStat.birthtime > stats.newestEntry) {
                stats.newestEntry = fileStat.birthtime;
              }

              // Read product files to check Tokopedia flags
              if (type === 'products') {
                const content = await readFile(filepath, 'utf8');
                const entry: TikTokShopDataEntry = JSON.parse(content);
                
                if (entry.metadata.tokopediaEnabled) {
                  stats.tokopediaEnabledCount++;
                } else {
                  stats.tokopediaDisabledCount++;
                }

                totalProductSize += fileStat.size;
                productCount++;
              }
            } catch (error) {
              this.logProgress('warn', `Could not process file ${file}: ${error}`);
            }
          }
        }
      }

      stats.averageProductSize = productCount > 0 ? Math.round(totalProductSize / productCount) : 0;

      return stats;
    } catch (error) {
      this.logProgress('error', `Failed to get TikTok Shop storage stats: ${error}`);
      return stats;
    }
  }

  /**
   * Get Tokopedia-enabled products
   */
  async getTokopediaEnabledProducts(): Promise<TikTokShopDataEntry[]> {
    const tokopediaProducts: TikTokShopDataEntry[] = [];
    
    try {
      const tokopediaPath = path.join(this.basePath, 'tokopedia');
      
      if (existsSync(tokopediaPath)) {
        const files = await readdir(tokopediaPath);
        
        for (const file of files.filter(f => f.endsWith('.json'))) {
          try {
            const filepath = path.join(tokopediaPath, file);
            const content = await readFile(filepath, 'utf8');
            const entry: TikTokShopDataEntry = JSON.parse(content);
            tokopediaProducts.push(entry);
          } catch (error) {
            this.logProgress('warn', `Could not read Tokopedia product file ${file}: ${error}`);
          }
        }
      }

      this.logProgress('info', `Retrieved ${tokopediaProducts.length} Tokopedia-enabled products`);
      return tokopediaProducts;
    } catch (error) {
      this.logProgress('error', `Failed to get Tokopedia-enabled products: ${error}`);
      return [];
    }
  }

  /**
   * Generate comprehensive TikTok Shop storage report
   */
  async generateReport(): Promise<string> {
    const stats = await this.getStats();
    const tokopediaProducts = await getTokopediaEnabledProducts();
    
    let report = `📊 TikTok Shop Data Storage Report\n`;
    report += `===================================\n\n`;
    report += `Total Entries: ${stats.totalEntries}\n`;
    report += `Total Size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB\n`;
    report += `Average Product Size: ${(stats.averageProductSize / 1024).toFixed(2)} KB\n\n`;

    report += `Entries by Type:\n`;
    Object.entries(stats.entriesByType).forEach(([type, count]) => {
      report += `  ${type}: ${count}\n`;
    });

    report += `\nTokopedia Integration:\n`;
    report += `  Enabled Products: ${stats.tokopediaEnabledCount}\n`;
    report += `  Disabled Products: ${stats.tokopediaDisabledCount}\n`;
    const totalProducts = stats.tokopediaEnabledCount + stats.tokopediaDisabledCount;
    if (totalProducts > 0) {
      const tokopediaPercentage = Math.round((stats.tokopediaEnabledCount / totalProducts) * 100);
      report += `  Tokopedia Percentage: ${tokopediaPercentage}%\n`;
    }

    if (stats.oldestEntry && stats.newestEntry) {
      report += `\nDate Range:\n`;
      report += `  Oldest: ${stats.oldestEntry.toISOString()}\n`;
      report += `  Newest: ${stats.newestEntry.toISOString()}\n`;
    }

    report += `\nProgress Logs Summary:\n`;
    const logSummary = {
      total: this.progressLogs.length,
      info: this.progressLogs.filter(l => l.level === 'info').length,
      warn: this.progressLogs.filter(l => l.level === 'warn').length,
      error: this.progressLogs.filter(l => l.level === 'error').length,
      tokopediaRelated: this.progressLogs.filter(l => l.context?.tokopediaFlag).length,
    };

    report += `  Total Logs: ${logSummary.total}\n`;
    report += `  Info: ${logSummary.info}\n`;
    report += `  Warnings: ${logSummary.warn}\n`;
    report += `  Errors: ${logSummary.error}\n`;
    report += `  Tokopedia Related: ${logSummary.tokopediaRelated}\n`;

    return report;
  }

  /**
   * Clear progress logs
   */
  clearProgressLogs(): void {
    this.progressLogs = [];
    this.logProgress('info', 'Progress logs cleared');
  }

  /**
   * Get recent progress logs
   */
  getRecentLogs(count = 50): TikTokShopProgressLog[] {
    return this.progressLogs.slice(-count);
  }
}

// Export singleton instance
export const tiktokShopDataStore = new TikTokShopDataStore();

// Helper function to get Tokopedia products (for report generation)
async function getTokopediaEnabledProducts(): Promise<TikTokShopDataEntry[]> {
  return tiktokShopDataStore.getTokopediaEnabledProducts();
}