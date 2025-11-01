/**
 * Data Anonymization Service
 * Implements data anonymization for analytics and reporting while preserving privacy
 */

import { randomBytes, createHash } from 'crypto';

export interface AnonymizationConfig {
  preserveFormat?: boolean;
  saltLength?: number;
  hashAlgorithm?: 'sha256' | 'sha512';
  dateGranularity?: 'day' | 'week' | 'month' | 'year';
}

export class DataAnonymizationService {
  private static readonly DEFAULT_SALT_LENGTH = 16;
  private static readonly DEFAULT_HASH_ALGORITHM = 'sha256';

  /**
   * Generate a consistent salt for anonymization
   */
  private static generateSalt(identifier: string, length: number = this.DEFAULT_SALT_LENGTH): string {
    // Use a deterministic salt based on identifier for consistency
    const hash = createHash('sha256').update(identifier).digest('hex');
    return hash.substring(0, length * 2); // Each byte becomes 2 hex chars
  }

  /**
   * Anonymize personal identifiers (emails, names, etc.)
   */
  static anonymizeIdentifier(
    value: string,
    config: AnonymizationConfig = {}
  ): string {
    if (!value || value.trim() === '') {
      return '';
    }

    const {
      preserveFormat = false,
      saltLength = this.DEFAULT_SALT_LENGTH,
      hashAlgorithm = this.DEFAULT_HASH_ALGORITHM,
    } = config;

    const salt = this.generateSalt(value, saltLength);
    const hash = createHash(hashAlgorithm)
      .update(value + salt)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for readability

    if (preserveFormat && value.includes('@')) {
      // Preserve email format
      return `user_${hash}@anonymized.local`;
    }

    if (preserveFormat && value.includes(' ')) {
      // Preserve name format (first last)
      return `User_${hash.substring(0, 8)} ${hash.substring(8, 16)}`;
    }

    return `anon_${hash}`;
  }

  /**
   * Anonymize phone numbers
   */
  static anonymizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return '';
    }

    // Keep country code and format, anonymize the rest
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const countryCode = cleaned.substring(0, Math.max(1, cleaned.length - 10));
      const hash = createHash('sha256')
        .update(phoneNumber)
        .digest('hex')
        .substring(0, 10);
      
      return `+${countryCode}${hash}`;
    }

    return 'xxx-xxx-xxxx';
  }

  /**
   * Anonymize addresses while preserving geographic regions
   */
  static anonymizeAddress(address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  }): {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } {
    const anonymized = { ...address };

    // Anonymize street address completely
    if (anonymized.street) {
      const hash = createHash('sha256')
        .update(anonymized.street)
        .digest('hex')
        .substring(0, 8);
      anonymized.street = `${hash} Anonymous St`;
    }

    // Keep city but anonymize if it's too specific (population < 100k)
    if (anonymized.city) {
      // In a real implementation, you'd check city population
      // For now, anonymize all cities
      const hash = createHash('sha256')
        .update(anonymized.city)
        .digest('hex')
        .substring(0, 8);
      anonymized.city = `City_${hash}`;
    }

    // Keep state/province and country for geographic analysis
    // Anonymize postal code to region level
    if (anonymized.postalCode) {
      // Keep first 2-3 digits for regional analysis
      const regionCode = anonymized.postalCode.substring(0, 3);
      anonymized.postalCode = `${regionCode}xxx`;
    }

    return anonymized;
  }

  /**
   * Anonymize dates while preserving time-based analysis
   */
  static anonymizeDate(
    date: Date,
    granularity: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Date {
    const anonymizedDate = new Date(date);

    switch (granularity) {
      case 'year':
        anonymizedDate.setMonth(0, 1);
        anonymizedDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        anonymizedDate.setDate(1);
        anonymizedDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        // Set to Monday of the week
        const dayOfWeek = anonymizedDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        anonymizedDate.setDate(anonymizedDate.getDate() - daysToMonday);
        anonymizedDate.setHours(0, 0, 0, 0);
        break;
      case 'day':
        anonymizedDate.setHours(0, 0, 0, 0);
        break;
    }

    return anonymizedDate;
  }

  /**
   * Anonymize numerical values while preserving statistical properties
   */
  static anonymizeNumericalValue(
    value: number,
    config: {
      addNoise?: boolean;
      noisePercentage?: number;
      roundTo?: number;
      preserveRange?: boolean;
    } = {}
  ): number {
    const {
      addNoise = true,
      noisePercentage = 5, // 5% noise
      roundTo = 2,
      preserveRange = true,
    } = config;

    let anonymizedValue = value;

    if (addNoise) {
      const noiseRange = value * (noisePercentage / 100);
      const noise = (Math.random() - 0.5) * 2 * noiseRange;
      anonymizedValue += noise;
    }

    if (preserveRange && anonymizedValue < 0 && value >= 0) {
      anonymizedValue = Math.abs(anonymizedValue);
    }

    return Math.round(anonymizedValue * Math.pow(10, roundTo)) / Math.pow(10, roundTo);
  }

  /**
   * Anonymize IP addresses while preserving network information
   */
  static anonymizeIPAddress(ipAddress: string): string {
    if (!ipAddress || ipAddress === 'unknown') {
      return 'unknown';
    }

    // For IPv4, keep first two octets for geographic/ISP analysis
    if (ipAddress.includes('.')) {
      const parts = ipAddress.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
      }
    }

    // For IPv6, keep first 4 groups
    if (ipAddress.includes(':')) {
      const parts = ipAddress.split(':');
      if (parts.length >= 4) {
        return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::xxxx`;
      }
    }

    return 'xxx.xxx.xxx.xxx';
  }

  /**
   * Anonymize user agent strings while preserving browser/OS info
   */
  static anonymizeUserAgent(userAgent: string): string {
    if (!userAgent) {
      return 'unknown';
    }

    // Extract browser and OS information, remove version details
    let anonymized = userAgent;

    // Remove version numbers but keep browser names
    anonymized = anonymized.replace(/\d+\.\d+(\.\d+)*/g, 'x.x');
    
    // Remove specific build numbers and identifiers
    anonymized = anonymized.replace(/\b[A-Z0-9]{8,}\b/g, 'XXXXXXXX');
    
    // Keep general browser and OS info
    const browserPatterns = [
      'Chrome', 'Firefox', 'Safari', 'Edge', 'Opera',
      'Windows', 'macOS', 'Linux', 'Android', 'iOS'
    ];

    let preservedInfo = '';
    browserPatterns.forEach(pattern => {
      if (userAgent.includes(pattern)) {
        preservedInfo += pattern + ' ';
      }
    });

    return preservedInfo.trim() || 'Unknown Browser/OS';
  }

  /**
   * Anonymize a complete user record
   */
  static anonymizeUserRecord(user: {
    id?: string;
    email?: string;
    name?: string;
    phone?: string;
    address?: any;
    createdAt?: Date;
    lastActiveAt?: Date;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
  }): any {
    const anonymized = { ...user };

    // Generate consistent anonymous ID
    if (anonymized.id) {
      anonymized.id = this.anonymizeIdentifier(anonymized.id);
    }

    // Anonymize personal information
    if (anonymized.email) {
      anonymized.email = this.anonymizeIdentifier(anonymized.email, { preserveFormat: true });
    }

    if (anonymized.name) {
      anonymized.name = this.anonymizeIdentifier(anonymized.name, { preserveFormat: true });
    }

    if (anonymized.phone) {
      anonymized.phone = this.anonymizePhoneNumber(anonymized.phone);
    }

    if (anonymized.address) {
      anonymized.address = this.anonymizeAddress(anonymized.address);
    }

    // Anonymize dates to month granularity
    if (anonymized.createdAt) {
      anonymized.createdAt = this.anonymizeDate(anonymized.createdAt, 'month');
    }

    if (anonymized.lastActiveAt) {
      anonymized.lastActiveAt = this.anonymizeDate(anonymized.lastActiveAt, 'day');
    }

    // Anonymize technical information
    if (anonymized.ipAddress) {
      anonymized.ipAddress = this.anonymizeIPAddress(anonymized.ipAddress);
    }

    if (anonymized.userAgent) {
      anonymized.userAgent = this.anonymizeUserAgent(anonymized.userAgent);
    }

    return anonymized;
  }

  /**
   * Anonymize order data for analytics
   */
  static anonymizeOrderRecord(order: {
    id?: string;
    customerId?: string;
    customerEmail?: string;
    customerName?: string;
    shippingAddress?: any;
    billingAddress?: any;
    totalAmount?: number;
    items?: any[];
    createdAt?: Date;
    [key: string]: any;
  }): any {
    const anonymized = { ...order };

    // Generate consistent anonymous IDs
    if (anonymized.id) {
      anonymized.id = this.anonymizeIdentifier(anonymized.id);
    }

    if (anonymized.customerId) {
      anonymized.customerId = this.anonymizeIdentifier(anonymized.customerId);
    }

    // Anonymize customer information
    if (anonymized.customerEmail) {
      anonymized.customerEmail = this.anonymizeIdentifier(
        anonymized.customerEmail,
        { preserveFormat: true }
      );
    }

    if (anonymized.customerName) {
      anonymized.customerName = this.anonymizeIdentifier(
        anonymized.customerName,
        { preserveFormat: true }
      );
    }

    // Anonymize addresses
    if (anonymized.shippingAddress) {
      anonymized.shippingAddress = this.anonymizeAddress(anonymized.shippingAddress);
    }

    if (anonymized.billingAddress) {
      anonymized.billingAddress = this.anonymizeAddress(anonymized.billingAddress);
    }

    // Add noise to financial data
    if (anonymized.totalAmount) {
      anonymized.totalAmount = this.anonymizeNumericalValue(anonymized.totalAmount, {
        noisePercentage: 2, // Small noise for financial data
        roundTo: 2,
      });
    }

    // Anonymize order items
    if (anonymized.items && Array.isArray(anonymized.items)) {
      anonymized.items = anonymized.items.map((item: any) => ({
        ...item,
        productId: item.productId ? this.anonymizeIdentifier(item.productId) : undefined,
        price: item.price ? this.anonymizeNumericalValue(item.price, { noisePercentage: 2 }) : undefined,
      }));
    }

    // Anonymize date to day granularity for order analysis
    if (anonymized.createdAt) {
      anonymized.createdAt = this.anonymizeDate(anonymized.createdAt, 'day');
    }

    return anonymized;
  }

  /**
   * Create anonymized dataset for analytics
   */
  static createAnonymizedDataset<T>(
    data: T[],
    anonymizer: (record: T) => T
  ): T[] {
    return data.map(record => anonymizer(record));
  }

  /**
   * Validate anonymization quality
   */
  static validateAnonymization(
    original: any,
    anonymized: any
  ): {
    isValid: boolean;
    issues: string[];
    score: number; // 0-100, higher is better
  } {
    const issues: string[] = [];
    let score = 100;

    // Check for direct personal information leakage
    const personalFields = ['email', 'name', 'phone', 'address'];
    personalFields.forEach(field => {
      if (original[field] && anonymized[field] === original[field]) {
        issues.push(`Personal field '${field}' not anonymized`);
        score -= 20;
      }
    });

    // Check for ID preservation (should be anonymized)
    if (original.id && anonymized.id === original.id) {
      issues.push('ID not anonymized');
      score -= 15;
    }

    // Check for email format preservation without content
    if (original.email && anonymized.email) {
      if (anonymized.email.includes('@') && !anonymized.email.includes('anonymized')) {
        issues.push('Email format preserved but content not properly anonymized');
        score -= 10;
      }
    }

    // Check for date granularity
    if (original.createdAt && anonymized.createdAt) {
      const originalDate = new Date(original.createdAt);
      const anonymizedDate = new Date(anonymized.createdAt);
      
      if (originalDate.getTime() === anonymizedDate.getTime()) {
        issues.push('Date not anonymized to appropriate granularity');
        score -= 10;
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: Math.max(0, score),
    };
  }
}