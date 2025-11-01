/**
 * SEO Title Generator for SyncStore Phase 1
 * Implements platform-specific title variations (70-80% similar, 20-30% unique)
 * Creates title generation logic for Shopee, TikTok, and future website
 * Adds keyword optimization for each platform's algorithm
 * 
 * Requirements: 3.5 - SEO title variations
 */

import { z } from 'zod';

// ============================================================================
// SEO CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Platform SEO configuration schema
 */
export const PlatformSEOConfigSchema = z.object({
  platform: z.enum(['shopee', 'tiktokshop', 'website', 'tokopedia']),
  maxTitleLength: z.number().int().min(10).max(200),
  preferredLength: z.number().int().min(10).max(200),
  keywordDensity: z.number().min(0).max(100), // Percentage
  priorityKeywords: z.array(z.string()),
  bannedWords: z.array(z.string()).default([]),
  titlePatterns: z.array(z.string()),
  isActive: z.boolean().default(true),
});

/**
 * Title generation result schema
 */
export const TitleGenerationResultSchema = z.object({
  platform: z.string(),
  originalTitle: z.string(),
  generatedTitle: z.string(),
  similarity: z.number().min(0).max(100), // Similarity percentage to original
  keywordsUsed: z.array(z.string()),
  optimizedFor: z.array(z.string()),
  length: z.number().int(),
  qualityScore: z.number().min(0).max(100),
  generatedAt: z.date(),
});

/**
 * Bulk title generation result schema
 */
export const BulkTitleGenerationResultSchema = z.object({
  originalTitle: z.string(),
  platformTitles: z.array(TitleGenerationResultSchema),
  averageSimilarity: z.number().min(0).max(100),
  totalPlatforms: z.number().int().min(0),
  generatedAt: z.date(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PlatformSEOConfig = z.infer<typeof PlatformSEOConfigSchema>;
export type TitleGenerationResult = z.infer<typeof TitleGenerationResultSchema>;
export type BulkTitleGenerationResult = z.infer<typeof BulkTitleGenerationResultSchema>;

// ============================================================================
// DEFAULT PLATFORM SEO CONFIGURATIONS
// ============================================================================

/**
 * Default SEO configurations for each platform
 * Based on platform-specific algorithms and best practices
 */
export const DEFAULT_SEO_CONFIGS: PlatformSEOConfig[] = [
  {
    platform: 'shopee',
    maxTitleLength: 120,
    preferredLength: 80,
    keywordDensity: 15,
    priorityKeywords: [
      'murah', 'berkualitas', 'original', 'terbaru', 'promo',
      'drone', 'fpv', 'racing', 'carbon', 'frame', 'parts',
      'ringan', 'kuat', 'tahan lama', 'premium'
    ],
    bannedWords: ['fake', 'kw', 'tiruan', 'bajakan'],
    titlePatterns: [
      '{product} {material} {size} - {quality} {category}',
      '{category} {product} {material} {feature} {size}',
      '{quality} {product} {material} untuk {application}',
      '{product} {size} {material} {feature} - {benefit}'
    ],
    isActive: true,
  },
  {
    platform: 'tiktokshop',
    maxTitleLength: 100,
    preferredLength: 70,
    keywordDensity: 20,
    priorityKeywords: [
      'viral', 'trending', 'hits', 'recommended', 'best seller',
      'drone', 'fpv', 'racing', 'carbon fiber', 'lightweight',
      'durable', 'professional', 'upgrade', 'performance'
    ],
    bannedWords: ['fake', 'replica', 'copy'],
    titlePatterns: [
      '🔥 {product} {material} {size} {feature}',
      '✨ {quality} {product} {material} - {benefit}',
      '🚀 {category} {product} {size} {application}',
      '⭐ {product} {material} {feature} {size}'
    ],
    isActive: true,
  },
  {
    platform: 'tokopedia',
    maxTitleLength: 70,
    preferredLength: 60,
    keywordDensity: 18,
    priorityKeywords: [
      'original', 'berkualitas', 'terpercaya', 'garansi',
      'drone parts', 'fpv racing', 'carbon fiber', 'frame',
      'ringan', 'kuat', 'profesional', 'upgrade'
    ],
    bannedWords: ['kw', 'tiruan', 'fake'],
    titlePatterns: [
      '{product} {material} {size} {quality}',
      '{category} {product} {feature} {size}',
      '{quality} {product} {material} - {application}',
      '{product} {size} {material} {benefit}'
    ],
    isActive: true,
  },
  {
    platform: 'website',
    maxTitleLength: 60,
    preferredLength: 50,
    keywordDensity: 10,
    priorityKeywords: [
      'fpv', 'drone', 'racing', 'carbon fiber', 'frame',
      'lightweight', 'durable', 'professional', 'custom',
      '3d printed', 'precision', 'performance', 'upgrade'
    ],
    bannedWords: [],
    titlePatterns: [
      '{product} {material} {size} - {specification}',
      '{category}: {product} {material} {feature}',
      '{product} {size} {material} ({specification})',
      'Professional {product} {material} {size}'
    ],
    isActive: true,
  },
];

// ============================================================================
// KEYWORD DATABASES
// ============================================================================

/**
 * FPV Drone parts keyword database
 */
export const FPV_KEYWORDS = {
  products: [
    'frame', 'motor', 'propeller', 'esc', 'flight controller',
    'camera', 'vtx', 'antenna', 'battery', 'charger',
    'receiver', 'transmitter', 'goggles', 'mount'
  ],
  materials: [
    'carbon fiber', 'carbon', 'aluminum', 'plastic', 'tpu',
    '3d printed', 'cnc', 'titanium', 'steel', 'composite'
  ],
  sizes: [
    '5 inch', '3 inch', '7 inch', '2.5 inch', '6 inch',
    '65mm', '75mm', '85mm', '110mm', '130mm', '180mm',
    '210mm', '250mm', '300mm', 'micro', 'mini', 'standard'
  ],
  features: [
    'lightweight', 'durable', 'aerodynamic', 'low profile',
    'high performance', 'racing', 'freestyle', 'cinematic',
    'long range', 'precision', 'responsive', 'stable'
  ],
  qualities: [
    'premium', 'professional', 'high quality', 'original',
    'authentic', 'certified', 'tested', 'proven', 'reliable'
  ],
  applications: [
    'racing', 'freestyle', 'cinematic', 'long range',
    'indoor', 'outdoor', 'competition', 'hobby', 'professional'
  ],
  benefits: [
    'faster response', 'better control', 'longer flight time',
    'improved stability', 'enhanced performance', 'easy installation',
    'perfect fit', 'crash resistant', 'weather resistant'
  ]
};

// ============================================================================
// TITLE GENERATOR CLASS
// ============================================================================

/**
 * Main SEO title generator class
 * Handles platform-specific title generation with similarity control
 */
export class SEOTitleGenerator {
  private platformConfigs: Map<string, PlatformSEOConfig>;
  private keywordDatabase: typeof FPV_KEYWORDS;

  constructor(configs?: PlatformSEOConfig[], keywordDb?: typeof FPV_KEYWORDS) {
    this.platformConfigs = new Map();
    this.keywordDatabase = keywordDb || FPV_KEYWORDS;
    
    // Load default configurations
    const configsToLoad = configs || DEFAULT_SEO_CONFIGS;
    configsToLoad.forEach(config => {
      this.addPlatformConfig(config);
    });
  }

  /**
   * Add or update platform SEO configuration
   */
  addPlatformConfig(config: PlatformSEOConfig): void {
    const validatedConfig = PlatformSEOConfigSchema.parse(config);
    this.platformConfigs.set(validatedConfig.platform, validatedConfig);
  }

  /**
   * Get platform SEO configuration
   */
  getPlatformConfig(platform: string): PlatformSEOConfig | undefined {
    return this.platformConfigs.get(platform);
  }

  /**
   * Extract keywords from title
   */
  private extractKeywords(title: string): string[] {
    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    const keywords: string[] = [];
    
    // Check for multi-word keywords first
    const titleLower = title.toLowerCase();
    Object.values(this.keywordDatabase).flat().forEach(keyword => {
      if (titleLower.includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    });

    // Add individual words that aren't already covered
    words.forEach(word => {
      if (!keywords.some(kw => kw.toLowerCase().includes(word))) {
        keywords.push(word);
      }
    });

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Calculate similarity between two titles
   */
  private calculateSimilarity(title1: string, title2: string): number {
    const words1 = new Set(title1.toLowerCase().split(/\s+/));
    const words2 = new Set(title2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
  }

  /**
   * Generate platform-specific keywords
   */
  private generatePlatformKeywords(
    baseKeywords: string[],
    platform: string,
    config: PlatformSEOConfig
  ): string[] {
    const platformKeywords = [...baseKeywords];
    
    // Add platform-specific priority keywords
    const relevantPriorityKeywords = config.priorityKeywords.filter(keyword => 
      !platformKeywords.some(existing => 
        existing.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    // Add 2-3 priority keywords based on keyword density
    const keywordsToAdd = Math.min(3, Math.floor(config.keywordDensity / 10));
    platformKeywords.push(...relevantPriorityKeywords.slice(0, keywordsToAdd));

    // Remove banned words
    return platformKeywords.filter(keyword => 
      !config.bannedWords.some(banned => 
        keyword.toLowerCase().includes(banned.toLowerCase())
      )
    );
  }

  /**
   * Apply title pattern
   */
  private applyTitlePattern(
    pattern: string,
    keywords: string[],
    originalTitle: string
  ): string {
    const keywordMap = this.categorizeKeywords(keywords, originalTitle);
    
    let result = pattern;
    
    // Replace pattern placeholders
    Object.entries(keywordMap).forEach(([category, words]) => {
      const placeholder = `{${category}}`;
      if (result.includes(placeholder) && words.length > 0) {
        // Use first available word for this category
        result = result.replace(placeholder, words[0]);
      }
    });

    // Remove any remaining placeholders
    result = result.replace(/\{[^}]+\}/g, '').trim();
    
    // Clean up extra spaces
    result = result.replace(/\s+/g, ' ').trim();
    
    return result || originalTitle; // Fallback to original if pattern fails
  }

  /**
   * Categorize keywords into semantic groups
   */
  private categorizeKeywords(keywords: string[], originalTitle: string): Record<string, string[]> {
    const categories: Record<string, string[]> = {
      product: [],
      material: [],
      size: [],
      feature: [],
      quality: [],
      category: [],
      application: [],
      benefit: [],
      specification: []
    };

    const titleLower = originalTitle.toLowerCase();
    
    // Categorize based on keyword database
    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      
      if (this.keywordDatabase.products.some(p => p.toLowerCase().includes(keywordLower))) {
        categories.product.push(keyword);
      } else if (this.keywordDatabase.materials.some(m => m.toLowerCase().includes(keywordLower))) {
        categories.material.push(keyword);
      } else if (this.keywordDatabase.sizes.some(s => s.toLowerCase().includes(keywordLower))) {
        categories.size.push(keyword);
      } else if (this.keywordDatabase.features.some(f => f.toLowerCase().includes(keywordLower))) {
        categories.feature.push(keyword);
      } else if (this.keywordDatabase.qualities.some(q => q.toLowerCase().includes(keywordLower))) {
        categories.quality.push(keyword);
      } else if (this.keywordDatabase.applications.some(a => a.toLowerCase().includes(keywordLower))) {
        categories.application.push(keyword);
      } else if (this.keywordDatabase.benefits.some(b => b.toLowerCase().includes(keywordLower))) {
        categories.benefit.push(keyword);
      } else {
        // Default categorization
        if (keywordLower.includes('frame') || keywordLower.includes('motor')) {
          categories.product.push(keyword);
        } else if (keywordLower.includes('carbon') || keywordLower.includes('aluminum')) {
          categories.material.push(keyword);
        } else if (/\d/.test(keyword)) {
          categories.size.push(keyword);
        } else {
          categories.specification.push(keyword);
        }
      }
    });

    // Ensure we have at least something in key categories
    if (categories.product.length === 0 && titleLower.includes('frame')) {
      categories.product.push('Frame');
    }
    if (categories.category.length === 0) {
      categories.category.push('Drone Parts');
    }

    return categories;
  }

  /**
   * Calculate title quality score
   */
  private calculateQualityScore(
    title: string,
    keywords: string[],
    config: PlatformSEOConfig
  ): number {
    let score = 100;

    // Length optimization (prefer preferred length)
    const lengthDiff = Math.abs(title.length - config.preferredLength);
    const lengthPenalty = Math.min(20, lengthDiff * 0.5);
    score -= lengthPenalty;

    // Keyword density
    const keywordCount = keywords.filter(keyword => 
      title.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    const actualDensity = (keywordCount / title.split(' ').length) * 100;
    const densityDiff = Math.abs(actualDensity - config.keywordDensity);
    const densityPenalty = Math.min(15, densityDiff * 0.3);
    score -= densityPenalty;

    // Priority keyword bonus
    const priorityKeywordsUsed = config.priorityKeywords.filter(keyword =>
      title.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    score += Math.min(10, priorityKeywordsUsed * 2);

    // Banned words penalty
    const bannedWordsUsed = config.bannedWords.filter(banned =>
      title.toLowerCase().includes(banned.toLowerCase())
    ).length;
    score -= bannedWordsUsed * 20;

    // Readability bonus (avoid too many special characters)
    const specialCharCount = (title.match(/[^\w\s]/g) || []).length;
    if (specialCharCount <= 3) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate title for a specific platform
   */
  generatePlatformTitle(
    originalTitle: string,
    platform: string,
    targetSimilarity?: number
  ): TitleGenerationResult {
    const config = this.platformConfigs.get(platform);
    if (!config) {
      throw new Error(`Platform configuration not found for: ${platform}`);
    }

    if (!config.isActive) {
      throw new Error(`Platform ${platform} is not active`);
    }

    const baseKeywords = this.extractKeywords(originalTitle);
    const platformKeywords = this.generatePlatformKeywords(baseKeywords, platform, config);
    
    // Try different patterns to achieve target similarity
    const targetSim = targetSimilarity || (platform === 'website' ? 85 : 75); // 70-80% similar
    let bestTitle = originalTitle;
    let bestSimilarity = 100;
    let bestScore = 0;

    for (const pattern of config.titlePatterns) {
      const candidateTitle = this.applyTitlePattern(pattern, platformKeywords, originalTitle);
      
      // Ensure title fits length constraints
      let finalTitle = candidateTitle;
      if (finalTitle.length > config.maxTitleLength) {
        finalTitle = finalTitle.substring(0, config.maxTitleLength - 3) + '...';
      }

      const similarity = this.calculateSimilarity(originalTitle, finalTitle);
      const qualityScore = this.calculateQualityScore(finalTitle, platformKeywords, config);
      
      // Score based on similarity target and quality
      const similarityScore = 100 - Math.abs(similarity - targetSim);
      const totalScore = (similarityScore * 0.6) + (qualityScore * 0.4);

      if (totalScore > bestScore) {
        bestTitle = finalTitle;
        bestSimilarity = similarity;
        bestScore = qualityScore;
      }
    }

    // Extract keywords actually used in the final title
    const usedKeywords = platformKeywords.filter(keyword =>
      bestTitle.toLowerCase().includes(keyword.toLowerCase())
    );

    return TitleGenerationResultSchema.parse({
      platform,
      originalTitle,
      generatedTitle: bestTitle,
      similarity: bestSimilarity,
      keywordsUsed: usedKeywords,
      optimizedFor: config.priorityKeywords.slice(0, 5),
      length: bestTitle.length,
      qualityScore: bestScore,
      generatedAt: new Date(),
    });
  }

  /**
   * Generate titles for all active platforms
   */
  generateAllPlatformTitles(
    originalTitle: string,
    targetSimilarity?: number
  ): BulkTitleGenerationResult {
    const activePlatforms = Array.from(this.platformConfigs.values())
      .filter(config => config.isActive);

    const platformTitles: TitleGenerationResult[] = [];

    for (const config of activePlatforms) {
      try {
        const result = this.generatePlatformTitle(originalTitle, config.platform, targetSimilarity);
        platformTitles.push(result);
      } catch (error) {
        console.warn(`Failed to generate title for platform ${config.platform}:`, error);
      }
    }

    const averageSimilarity = platformTitles.length > 0
      ? platformTitles.reduce((sum, result) => sum + result.similarity, 0) / platformTitles.length
      : 0;

    return BulkTitleGenerationResultSchema.parse({
      originalTitle,
      platformTitles,
      averageSimilarity,
      totalPlatforms: platformTitles.length,
      generatedAt: new Date(),
    });
  }

  /**
   * Validate title generation configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.platformConfigs.size === 0) {
      errors.push('No platform configurations found');
    }

    const activePlatforms = Array.from(this.platformConfigs.values())
      .filter(config => config.isActive);

    if (activePlatforms.length === 0) {
      warnings.push('No active platforms configured');
    }

    // Check configuration validity
    for (const config of this.platformConfigs.values()) {
      if (config.maxTitleLength < config.preferredLength) {
        errors.push(`Invalid length configuration for ${config.platform}: max < preferred`);
      }

      if (config.titlePatterns.length === 0) {
        warnings.push(`No title patterns configured for ${config.platform}`);
      }

      if (config.priorityKeywords.length === 0) {
        warnings.push(`No priority keywords configured for ${config.platform}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default SEO title generator instance
 */
export function createDefaultTitleGenerator(): SEOTitleGenerator {
  return new SEOTitleGenerator();
}

/**
 * Quick title generation for a single platform
 */
export function quickGenerateTitle(
  originalTitle: string,
  platform: string,
  targetSimilarity?: number
): string {
  const generator = createDefaultTitleGenerator();
  const result = generator.generatePlatformTitle(originalTitle, platform, targetSimilarity);
  return result.generatedTitle;
}

/**
 * Analyze title effectiveness
 */
export function analyzeTitleEffectiveness(title: string): {
  length: number;
  wordCount: number;
  keywordDensity: number;
  readabilityScore: number;
  suggestions: string[];
} {
  const words = title.split(/\s+/);
  const wordCount = words.length;
  const specialChars = (title.match(/[^\w\s]/g) || []).length;
  
  // Simple keyword density (FPV-related words)
  const fpvKeywords = ['drone', 'fpv', 'racing', 'frame', 'carbon', 'motor', 'propeller'];
  const keywordMatches = fpvKeywords.filter(keyword => 
    title.toLowerCase().includes(keyword)
  ).length;
  const keywordDensity = (keywordMatches / wordCount) * 100;

  // Simple readability score
  const avgWordLength = title.replace(/[^\w]/g, '').length / wordCount;
  const readabilityScore = Math.max(0, 100 - (avgWordLength * 5) - (specialChars * 2));

  const suggestions: string[] = [];
  
  if (title.length > 100) {
    suggestions.push('Consider shortening the title for better readability');
  }
  
  if (keywordDensity < 10) {
    suggestions.push('Add more relevant keywords to improve SEO');
  }
  
  if (specialChars > 5) {
    suggestions.push('Reduce special characters for better readability');
  }
  
  if (wordCount < 3) {
    suggestions.push('Add more descriptive words to improve clarity');
  }

  return {
    length: title.length,
    wordCount,
    keywordDensity,
    readabilityScore,
    suggestions,
  };
}

/**
 * Generate title variations for A/B testing
 */
export function generateTitleVariations(
  originalTitle: string,
  platform: string,
  count: number = 3
): string[] {
  const generator = createDefaultTitleGenerator();
  const variations: string[] = [];
  
  // Generate variations with different similarity targets
  const similarityTargets = [70, 75, 80, 85];
  
  for (let i = 0; i < count && i < similarityTargets.length; i++) {
    try {
      const result = generator.generatePlatformTitle(
        originalTitle, 
        platform, 
        similarityTargets[i]
      );
      variations.push(result.generatedTitle);
    } catch (error) {
      console.warn(`Failed to generate variation ${i + 1}:`, error);
    }
  }

  return [...new Set(variations)]; // Remove duplicates
}