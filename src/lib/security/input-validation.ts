/**
 * Input Validation and Sanitization Service
 * Comprehensive input validation and sanitization for all user inputs
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export class InputValidationService {
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: [],
    });
  }

  /**
   * Sanitize plain text input
   */
  static sanitizeText(input: string): string {
    return validator.escape(input.trim());
  }

  /**
   * Validate and sanitize email addresses
   */
  static validateEmail(email: string): { isValid: boolean; sanitized?: string; error?: string } {
    const trimmed = email.trim().toLowerCase();
    
    if (!validator.isEmail(trimmed)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    return { isValid: true, sanitized: trimmed };
  }

  /**
   * Validate and sanitize URLs
   */
  static validateUrl(url: string): { isValid: boolean; sanitized?: string; error?: string } {
    const trimmed = url.trim();
    
    if (!validator.isURL(trimmed, { 
      protocols: ['http', 'https'],
      require_protocol: true 
    })) {
      return { isValid: false, error: 'Invalid URL format' };
    }

    return { isValid: true, sanitized: trimmed };
  }

  /**
   * Validate SKU format
   */
  static validateSku(sku: string): { isValid: boolean; sanitized?: string; error?: string } {
    const trimmed = sku.trim().toUpperCase();
    
    // SKU should be alphanumeric with hyphens and underscores, 3-50 characters
    if (!/^[A-Z0-9_-]{3,50}$/.test(trimmed)) {
      return { 
        isValid: false, 
        error: 'SKU must be 3-50 characters, alphanumeric with hyphens and underscores only' 
      };
    }

    return { isValid: true, sanitized: trimmed };
  }

  /**
   * Validate phone numbers
   */
  static validatePhone(phone: string): { isValid: boolean; sanitized?: string; error?: string } {
    const cleaned = phone.replace(/\D/g, '');
    
    if (!validator.isMobilePhone(cleaned, 'any', { strictMode: false })) {
      return { isValid: false, error: 'Invalid phone number format' };
    }

    return { isValid: true, sanitized: cleaned };
  }

  /**
   * Validate and sanitize organization slug
   */
  static validateSlug(slug: string): { isValid: boolean; sanitized?: string; error?: string } {
    const trimmed = slug.trim().toLowerCase();
    
    // Slug should be lowercase alphanumeric with hyphens, 3-50 characters
    if (!/^[a-z0-9-]{3,50}$/.test(trimmed)) {
      return { 
        isValid: false, 
        error: 'Slug must be 3-50 characters, lowercase alphanumeric with hyphens only' 
      };
    }

    // Check for reserved slugs
    const reservedSlugs = [
      'admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'dashboard',
      'app', 'support', 'help', 'docs', 'blog', 'status', 'security'
    ];

    if (reservedSlugs.includes(trimmed)) {
      return { isValid: false, error: 'This slug is reserved and cannot be used' };
    }

    return { isValid: true, sanitized: trimmed };
  }

  /**
   * Validate monetary amounts
   */
  static validateAmount(amount: string | number): { isValid: boolean; sanitized?: number; error?: string } {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || numAmount < 0) {
      return { isValid: false, error: 'Amount must be a positive number' };
    }

    // Limit to 2 decimal places for currency
    const sanitized = Math.round(numAmount * 100) / 100;
    
    if (sanitized > 999999999.99) {
      return { isValid: false, error: 'Amount exceeds maximum allowed value' };
    }

    return { isValid: true, sanitized };
  }

  /**
   * Validate quantity values
   */
  static validateQuantity(quantity: string | number): { isValid: boolean; sanitized?: number; error?: string } {
    const numQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
    
    if (isNaN(numQuantity) || numQuantity < 0 || !Number.isInteger(numQuantity)) {
      return { isValid: false, error: 'Quantity must be a non-negative integer' };
    }

    if (numQuantity > 999999999) {
      return { isValid: false, error: 'Quantity exceeds maximum allowed value' };
    }

    return { isValid: true, sanitized: numQuantity };
  }

  /**
   * Validate JSON input
   */
  static validateJson(input: string): { isValid: boolean; parsed?: any; error?: string } {
    try {
      const parsed = JSON.parse(input);
      return { isValid: true, parsed };
    } catch (error) {
      return { isValid: false, error: 'Invalid JSON format' };
    }
  }

  /**
   * Validate file upload parameters
   */
  static validateFileUpload(file: {
    name: string;
    size: number;
    type: string;
  }): { isValid: boolean; error?: string } {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { isValid: false, error: 'File size exceeds 10MB limit' };
    }

    // Check file type for images
    const allowedImageTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
    ];

    if (!allowedImageTypes.includes(file.type)) {
      return { isValid: false, error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed' };
    }

    // Check filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
    if (sanitizedName !== file.name) {
      return { isValid: false, error: 'Filename contains invalid characters' };
    }

    return { isValid: true };
  }

  /**
   * Comprehensive request validation schema
   */
  static createValidationSchema() {
    return {
      // Organization validation
      organization: z.object({
        name: z.string()
          .min(1, 'Organization name is required')
          .max(255, 'Organization name too long')
          .transform(this.sanitizeText),
        slug: z.string()
          .min(3, 'Slug must be at least 3 characters')
          .max(50, 'Slug too long')
          .refine((slug) => this.validateSlug(slug).isValid, 'Invalid slug format'),
      }),

      // Product validation
      product: z.object({
        name: z.string()
          .min(1, 'Product name is required')
          .max(500, 'Product name too long')
          .transform(this.sanitizeText),
        sku: z.string()
          .min(3, 'SKU must be at least 3 characters')
          .max(50, 'SKU too long')
          .refine((sku) => this.validateSku(sku).isValid, 'Invalid SKU format'),
        description: z.string()
          .max(5000, 'Description too long')
          .optional()
          .transform((desc) => desc ? this.sanitizeHtml(desc) : undefined),
        category: z.string()
          .max(255, 'Category name too long')
          .optional()
          .transform((cat) => cat ? this.sanitizeText(cat) : undefined),
        brand: z.string()
          .max(255, 'Brand name too long')
          .optional()
          .transform((brand) => brand ? this.sanitizeText(brand) : undefined),
        costPrice: z.number()
          .min(0, 'Cost price must be positive')
          .max(999999999.99, 'Cost price too high')
          .optional(),
        weight: z.number()
          .min(0, 'Weight must be positive')
          .max(999999.99, 'Weight too high')
          .optional(),
      }),

      // Order validation
      order: z.object({
        customerInfo: z.object({
          name: z.string()
            .min(1, 'Customer name is required')
            .max(255, 'Customer name too long')
            .transform(this.sanitizeText),
          email: z.string()
            .email('Invalid email format')
            .transform((email) => email.toLowerCase().trim()),
          phone: z.string()
            .optional()
            .refine((phone) => !phone || this.validatePhone(phone).isValid, 'Invalid phone format'),
        }),
        subtotal: z.number()
          .min(0, 'Subtotal must be positive')
          .max(999999999.99, 'Subtotal too high'),
        totalAmount: z.number()
          .min(0, 'Total amount must be positive')
          .max(999999999.99, 'Total amount too high'),
      }),

      // Inventory validation
      inventory: z.object({
        quantityOnHand: z.number()
          .int('Quantity must be an integer')
          .min(0, 'Quantity cannot be negative')
          .max(999999999, 'Quantity too high'),
        reorderPoint: z.number()
          .int('Reorder point must be an integer')
          .min(0, 'Reorder point cannot be negative')
          .max(999999999, 'Reorder point too high'),
        reorderQuantity: z.number()
          .int('Reorder quantity must be an integer')
          .min(0, 'Reorder quantity cannot be negative')
          .max(999999999, 'Reorder quantity too high'),
      }),

      // Store validation
      store: z.object({
        name: z.string()
          .min(1, 'Store name is required')
          .max(255, 'Store name too long')
          .transform(this.sanitizeText),
        platformStoreId: z.string()
          .min(1, 'Platform store ID is required')
          .max(255, 'Platform store ID too long')
          .transform(this.sanitizeText),
      }),
    };
  }

  /**
   * Validate request body against schema
   */
  static async validateRequest<T>(
    data: unknown,
    schema: z.ZodSchema<T>
  ): Promise<{ success: true; data: T } | { success: false; errors: string[] }> {
    try {
      const validatedData = await schema.parseAsync(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { success: false, errors };
      }
      return { success: false, errors: ['Validation failed'] };
    }
  }

  /**
   * Rate limiting validation
   */
  static validateRateLimit(
    identifier: string,
    limit: number,
    windowMs: number,
    requests: Map<string, { count: number; resetTime: number }>
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const key = identifier;
    const current = requests.get(key);

    if (!current || now > current.resetTime) {
      // New window or expired window
      const resetTime = now + windowMs;
      requests.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: limit - 1, resetTime };
    }

    if (current.count >= limit) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: current.resetTime };
    }

    // Increment count
    current.count++;
    requests.set(key, current);
    return { allowed: true, remaining: limit - current.count, resetTime: current.resetTime };
  }
}