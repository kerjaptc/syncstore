/**
 * Conflict Resolution System
 * Handles data synchronization conflicts with configurable strategies
 */

export interface ConflictData {
  field: string;
  localValue: any;
  platformValue: any;
  lastModified: {
    local: Date;
    platform: Date;
  };
  metadata?: Record<string, any>;
}

export interface ConflictResolutionResult {
  resolvedValue: any;
  strategy: string;
  confidence: number;
  requiresManualReview: boolean;
  reason: string;
}

export interface ConflictResolutionRule {
  field: string;
  strategy: 'platform_wins' | 'local_wins' | 'newest_wins' | 'merge' | 'manual_review';
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  }>;
  priority: number;
}

export interface ConflictResolutionConfig {
  defaultStrategy: 'platform_wins' | 'local_wins' | 'newest_wins' | 'manual_review';
  rules: ConflictResolutionRule[];
  autoResolveThreshold: number; // Confidence threshold for auto-resolution
  mergeStrategies: Record<string, MergeStrategy>;
}

export interface MergeStrategy {
  type: 'array_union' | 'object_merge' | 'string_concat' | 'numeric_average' | 'custom';
  customHandler?: (localValue: any, platformValue: any) => any;
  separator?: string; // For string concatenation
}

export class ConflictResolver {
  private config: ConflictResolutionConfig;

  constructor(config?: Partial<ConflictResolutionConfig>) {
    this.config = {
      defaultStrategy: 'newest_wins',
      rules: [],
      autoResolveThreshold: 0.8,
      mergeStrategies: {
        images: { type: 'array_union' },
        tags: { type: 'array_union' },
        attributes: { type: 'object_merge' },
        description: { type: 'string_concat', separator: '\n\n---\n\n' },
      },
      ...config,
    };
  }

  /**
   * Resolve a single field conflict
   */
  resolveConflict(conflict: ConflictData): ConflictResolutionResult {
    // Find applicable rule
    const rule = this.findApplicableRule(conflict);
    const strategy = rule?.strategy || this.config.defaultStrategy;

    switch (strategy) {
      case 'platform_wins':
        return {
          resolvedValue: conflict.platformValue,
          strategy: 'platform_wins',
          confidence: 1.0,
          requiresManualReview: false,
          reason: 'Platform value takes precedence',
        };

      case 'local_wins':
        return {
          resolvedValue: conflict.localValue,
          strategy: 'local_wins',
          confidence: 1.0,
          requiresManualReview: false,
          reason: 'Local value takes precedence',
        };

      case 'newest_wins':
        return this.resolveByTimestamp(conflict);

      case 'merge':
        return this.resolveMerge(conflict);

      case 'manual_review':
      default:
        return {
          resolvedValue: conflict.localValue, // Keep current value until manual review
          strategy: 'manual_review',
          confidence: 0.0,
          requiresManualReview: true,
          reason: 'Conflict requires manual review',
        };
    }
  }

  /**
   * Resolve multiple conflicts in batch
   */
  resolveConflicts(conflicts: ConflictData[]): {
    resolved: Array<ConflictData & ConflictResolutionResult>;
    requiresManualReview: ConflictData[];
    autoResolved: ConflictData[];
  } {
    const resolved: Array<ConflictData & ConflictResolutionResult> = [];
    const requiresManualReview: ConflictData[] = [];
    const autoResolved: ConflictData[] = [];

    for (const conflict of conflicts) {
      const result = this.resolveConflict(conflict);
      const resolvedConflict = { ...conflict, ...result };
      
      resolved.push(resolvedConflict);

      if (result.requiresManualReview || result.confidence < this.config.autoResolveThreshold) {
        requiresManualReview.push(conflict);
      } else {
        autoResolved.push(conflict);
      }
    }

    return {
      resolved,
      requiresManualReview,
      autoResolved,
    };
  }

  /**
   * Find applicable rule for a conflict
   */
  private findApplicableRule(conflict: ConflictData): ConflictResolutionRule | null {
    const applicableRules = this.config.rules
      .filter(rule => this.isRuleApplicable(rule, conflict))
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    return applicableRules[0] || null;
  }

  /**
   * Check if a rule is applicable to a conflict
   */
  private isRuleApplicable(rule: ConflictResolutionRule, conflict: ConflictData): boolean {
    // Check field match
    if (rule.field !== '*' && rule.field !== conflict.field) {
      return false;
    }

    // Check conditions
    if (rule.conditions) {
      return rule.conditions.every(condition => 
        this.evaluateCondition(condition, conflict)
      );
    }

    return true;
  }

  /**
   * Evaluate a rule condition
   */
  private evaluateCondition(
    condition: ConflictResolutionRule['conditions'][0],
    conflict: ConflictData
  ): boolean {
    let fieldValue: any;

    switch (condition.field) {
      case 'local_value':
        fieldValue = conflict.localValue;
        break;
      case 'platform_value':
        fieldValue = conflict.platformValue;
        break;
      case 'field':
        fieldValue = conflict.field;
        break;
      default:
        fieldValue = conflict.metadata?.[condition.field];
        break;
    }

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'greater_than':
        return fieldValue > condition.value;
      case 'less_than':
        return fieldValue < condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Resolve conflict by timestamp (newest wins)
   */
  private resolveByTimestamp(conflict: ConflictData): ConflictResolutionResult {
    const platformNewer = conflict.lastModified.platform > conflict.lastModified.local;
    const timeDiff = Math.abs(
      conflict.lastModified.platform.getTime() - conflict.lastModified.local.getTime()
    );

    // If timestamps are very close (within 1 minute), consider it a tie
    if (timeDiff < 60000) {
      return {
        resolvedValue: conflict.platformValue, // Default to platform in case of tie
        strategy: 'newest_wins',
        confidence: 0.5,
        requiresManualReview: true,
        reason: 'Timestamps too close to determine clear winner',
      };
    }

    return {
      resolvedValue: platformNewer ? conflict.platformValue : conflict.localValue,
      strategy: 'newest_wins',
      confidence: 0.9,
      requiresManualReview: false,
      reason: `${platformNewer ? 'Platform' : 'Local'} value is newer`,
    };
  }

  /**
   * Resolve conflict by merging values
   */
  private resolveMerge(conflict: ConflictData): ConflictResolutionResult {
    const mergeStrategy = this.config.mergeStrategies[conflict.field];
    
    if (!mergeStrategy) {
      return {
        resolvedValue: conflict.localValue,
        strategy: 'merge',
        confidence: 0.0,
        requiresManualReview: true,
        reason: 'No merge strategy defined for this field',
      };
    }

    try {
      const mergedValue = this.performMerge(
        conflict.localValue,
        conflict.platformValue,
        mergeStrategy
      );

      return {
        resolvedValue: mergedValue,
        strategy: 'merge',
        confidence: 0.8,
        requiresManualReview: false,
        reason: `Values merged using ${mergeStrategy.type} strategy`,
      };
    } catch (error) {
      return {
        resolvedValue: conflict.localValue,
        strategy: 'merge',
        confidence: 0.0,
        requiresManualReview: true,
        reason: `Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Perform value merge based on strategy
   */
  private performMerge(localValue: any, platformValue: any, strategy: MergeStrategy): any {
    switch (strategy.type) {
      case 'array_union':
        if (!Array.isArray(localValue) || !Array.isArray(platformValue)) {
          throw new Error('Array union requires both values to be arrays');
        }
        return [...new Set([...localValue, ...platformValue])];

      case 'object_merge':
        if (typeof localValue !== 'object' || typeof platformValue !== 'object') {
          throw new Error('Object merge requires both values to be objects');
        }
        return { ...localValue, ...platformValue };

      case 'string_concat':
        const separator = strategy.separator || ' ';
        return `${String(localValue)}${separator}${String(platformValue)}`;

      case 'numeric_average':
        const local = Number(localValue);
        const platform = Number(platformValue);
        if (isNaN(local) || isNaN(platform)) {
          throw new Error('Numeric average requires both values to be numbers');
        }
        return (local + platform) / 2;

      case 'custom':
        if (!strategy.customHandler) {
          throw new Error('Custom merge strategy requires a custom handler');
        }
        return strategy.customHandler(localValue, platformValue);

      default:
        throw new Error(`Unknown merge strategy: ${strategy.type}`);
    }
  }

  /**
   * Add or update a conflict resolution rule
   */
  addRule(rule: ConflictResolutionRule): void {
    const existingIndex = this.config.rules.findIndex(
      r => r.field === rule.field && r.priority === rule.priority
    );

    if (existingIndex >= 0) {
      this.config.rules[existingIndex] = rule;
    } else {
      this.config.rules.push(rule);
    }

    // Sort rules by priority
    this.config.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a conflict resolution rule
   */
  removeRule(field: string, priority: number): void {
    this.config.rules = this.config.rules.filter(
      rule => !(rule.field === field && rule.priority === priority)
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): ConflictResolutionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ConflictResolutionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Create default rules for common e-commerce fields
   */
  static createDefaultRules(): ConflictResolutionRule[] {
    return [
      // Price conflicts - platform wins (usually more up-to-date)
      {
        field: 'price',
        strategy: 'platform_wins',
        priority: 100,
      },
      
      // Inventory - platform wins (real-time data)
      {
        field: 'inventory',
        strategy: 'platform_wins',
        priority: 100,
      },
      
      // Product status - platform wins
      {
        field: 'status',
        strategy: 'platform_wins',
        priority: 90,
      },
      
      // Images - merge by union
      {
        field: 'images',
        strategy: 'merge',
        priority: 80,
      },
      
      // Tags - merge by union
      {
        field: 'tags',
        strategy: 'merge',
        priority: 80,
      },
      
      // Attributes - merge objects
      {
        field: 'attributes',
        strategy: 'merge',
        priority: 70,
      },
      
      // Description - manual review for significant changes
      {
        field: 'description',
        strategy: 'manual_review',
        conditions: [
          {
            field: 'local_value',
            operator: 'not_equals',
            value: null,
          },
        ],
        priority: 60,
      },
      
      // Default rule - newest wins
      {
        field: '*',
        strategy: 'newest_wins',
        priority: 1,
      },
    ];
  }

  /**
   * Analyze conflict patterns for insights
   */
  analyzeConflicts(conflicts: ConflictData[]): {
    fieldFrequency: Record<string, number>;
    strategyUsage: Record<string, number>;
    manualReviewRate: number;
    averageConfidence: number;
  } {
    const fieldFrequency: Record<string, number> = {};
    const strategyUsage: Record<string, number> = {};
    let totalConfidence = 0;
    let manualReviews = 0;

    for (const conflict of conflicts) {
      // Count field frequency
      fieldFrequency[conflict.field] = (fieldFrequency[conflict.field] || 0) + 1;

      // Resolve to get strategy and confidence
      const result = this.resolveConflict(conflict);
      
      // Count strategy usage
      strategyUsage[result.strategy] = (strategyUsage[result.strategy] || 0) + 1;
      
      // Track confidence and manual reviews
      totalConfidence += result.confidence;
      if (result.requiresManualReview) {
        manualReviews++;
      }
    }

    return {
      fieldFrequency,
      strategyUsage,
      manualReviewRate: conflicts.length > 0 ? manualReviews / conflicts.length : 0,
      averageConfidence: conflicts.length > 0 ? totalConfidence / conflicts.length : 0,
    };
  }
}

/**
 * Default conflict resolver instance with e-commerce optimized rules
 */
export const defaultConflictResolver = new ConflictResolver({
  defaultStrategy: 'newest_wins',
  rules: ConflictResolver.createDefaultRules(),
  autoResolveThreshold: 0.8,
  mergeStrategies: {
    images: { type: 'array_union' },
    tags: { type: 'array_union' },
    attributes: { type: 'object_merge' },
    description: { type: 'string_concat', separator: '\n\n---\n\n' },
    categories: { type: 'array_union' },
  },
});