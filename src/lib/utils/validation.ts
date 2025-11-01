/**
 * Validation utilities for StoreSync
 */

import { AppError } from '@/lib/error-handling/app-error';
import DOMPurify from 'isomorphic-dompurify';

// SKU validation
export function validateSKU(sku: string): void {
  if (!sku || typeof sku !== 'string') {
    throw AppError.validation('SKU is required and must be a string');
  }
  
  if (sku.length < 2 || sku.length > 50) {
    throw AppError.validation('SKU must be between 2 and 50 characters');
  }
  
  if (!/^[A-Z0-9_-]+$/.test(sku)) {
    throw AppError.validation('SKU must contain only uppercase letters, numbers, hyphens, and underscores');
  }
}

// Email validation
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw AppError.validation('Email is required and must be a string');
  }
  
  if (email.length > 254) {
    throw AppError.validation('Email is too long');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.includes('..') || email.includes(' ')) {
    throw AppError.validation('Invalid email format');
  }
}

// Price validation
export function validatePrice(price: number): void {
  if (typeof price !== 'number' || isNaN(price) || !isFinite(price)) {
    throw AppError.validation('Price must be a valid number');
  }
  
  if (price <= 0) {
    throw AppError.validation('Price must be greater than zero');
  }
  
  if (price > 9999999) {
    throw AppError.validation('Price is too large');
  }
  
  // Check for more than 2 decimal places
  if (Math.round(price * 100) !== price * 100) {
    throw AppError.validation('Price cannot have more than 2 decimal places');
  }
}

// Quantity validation
export function validateQuantity(quantity: number): void {
  if (typeof quantity !== 'number' || isNaN(quantity) || !isFinite(quantity)) {
    throw AppError.validation('Quantity must be a valid number');
  }
  
  if (quantity < 0) {
    throw AppError.validation('Quantity cannot be negative');
  }
  
  if (!Number.isInteger(quantity)) {
    throw AppError.validation('Quantity must be a whole number');
  }
  
  if (quantity > 99999) {
    throw AppError.validation('Quantity is too large');
  }
}

// Product data validation
export function validateProductData(data: any): void {
  if (!data || typeof data !== 'object') {
    throw AppError.validation('Product data is required');
  }
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw AppError.validation('Product name is required');
  }
  
  if (data.sku) {
    validateSKU(data.sku);
  }
  
  if (data.costPrice !== undefined) {
    validatePrice(data.costPrice);
  }
  
  if (data.dimensions) {
    if (data.dimensions.length !== undefined && data.dimensions.length <= 0) {
      throw AppError.validation('Product length must be positive');
    }
    if (data.dimensions.width !== undefined && data.dimensions.width <= 0) {
      throw AppError.validation('Product width must be positive');
    }
    if (data.dimensions.height !== undefined && data.dimensions.height <= 0) {
      throw AppError.validation('Product height must be positive');
    }
  }
  
  if (data.attributes && typeof data.attributes === 'object') {
    for (const [key, value] of Object.entries(data.attributes)) {
      if (typeof value === 'string' && value.trim().length === 0) {
        throw AppError.validation(`Attribute ${key} cannot be empty`);
      }
    }
  }
}

// Order data validation
export function validateOrderData(data: any): void {
  if (!data || typeof data !== 'object') {
    throw AppError.validation('Order data is required');
  }
  
  if (!data.orderNumber || typeof data.orderNumber !== 'string') {
    throw AppError.validation('Order number is required');
  }
  
  if (!data.customer || typeof data.customer !== 'object') {
    throw AppError.validation('Customer information is required');
  }
  
  if (!data.customer.name || typeof data.customer.name !== 'string') {
    throw AppError.validation('Customer name is required');
  }
  
  if (data.customer.email) {
    validateEmail(data.customer.email);
  }
  
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw AppError.validation('Order must have at least one item');
  }
  
  let calculatedSubtotal = 0;
  for (const item of data.items) {
    if (!item.sku || !item.name) {
      throw AppError.validation('Order items must have SKU and name');
    }
    
    if (item.quantity <= 0) {
      throw AppError.validation('Order item quantity must be greater than zero');
    }
    
    validateQuantity(item.quantity);
    validatePrice(item.unitPrice);
    
    calculatedSubtotal += item.quantity * item.unitPrice;
  }
  
  if (data.totals) {
    const expectedTotal = calculatedSubtotal + (data.totals.tax || 0) + (data.totals.shipping || 0) - (data.totals.discount || 0);
    if (Math.abs(data.totals.total - expectedTotal) > 0.01) {
      throw AppError.validation('Order totals do not match calculated values');
    }
  }
}

// Input sanitization
export function sanitizeInput(input: any): string {
  if (input === null || input === undefined) {
    return '';
  }
  
  const str = String(input);
  
  // Remove HTML tags and potentially dangerous content
  let sanitized = DOMPurify.sanitize(str, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  
  // Additional security measures
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/DROP\s+TABLE/gi, '')
    .replace(/INSERT\s+INTO/gi, '')
    .replace(/UNION\s+SELECT/gi, '')
    .replace(/DELETE\s+FROM/gi, '');
  
  return sanitized.trim();
}

// Platform credentials validation
export function validatePlatformCredentials(data: any): void {
  if (!data || typeof data !== 'object') {
    throw AppError.validation('Platform credentials data is required');
  }
  
  if (!data.platform || typeof data.platform !== 'string') {
    throw AppError.validation('Platform is required');
  }
  
  if (!data.credentials || typeof data.credentials !== 'object') {
    throw AppError.validation('Credentials are required');
  }
  
  const { platform, credentials } = data;
  
  switch (platform) {
    case 'shopee':
      if (!credentials.accessToken || !credentials.refreshToken || !credentials.shopId || !credentials.partnerId) {
        throw AppError.validation('Shopee credentials must include accessToken, refreshToken, shopId, and partnerId');
      }
      break;
      
    case 'tiktokshop':
      if (!credentials.accessToken || !credentials.refreshToken || !credentials.shopId || !credentials.appKey) {
        throw AppError.validation('TikTok Shop credentials must include accessToken, refreshToken, shopId, and appKey');
      }
      break;
      
    default:
      throw AppError.validation(`Unsupported platform: ${platform}`);
  }
}