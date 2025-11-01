/**
 * Field Analyzer for Phase 1
 * Analyzes actual API response structures to validate field mapping
 */

import shopeeData from './mock-data/shopee-sample.json';
import tiktokData from './mock-data/tiktokshop-sample.json';

export interface FieldAnalysis {
  fieldName: string;
  shopeeField?: string;
  tiktokField?: string;
  shopeeValue?: any;
  tiktokValue?: any;
  dataType: string;
  isCommon: boolean;
  needsTransformation: boolean;
  notes: string;
}

export interface PlatformFieldMap {
  [key: string]: any;
}

/**
 * Extract all fields from an object recursively
 */
function extractFields(obj: any, prefix = ''): PlatformFieldMap {
  const fields: PlatformFieldMap = {};
  
  if (obj === null || obj === undefined) {
    return fields;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      // Analyze first item in array
      const arrayFields = extractFields(obj[0], prefix + '[0]');
      Object.keys(arrayFields).forEach(key => {
        fields[key] = arrayFields[key];
      });
    }
    return fields;
  }
  
  if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively extract nested fields
        const nestedFields = extractFields(value, fullKey);
        Object.assign(fields, nestedFields);
      } else {
        fields[fullKey] = value;
      }
    });
  } else {
    fields[prefix] = obj;
  }
  
  return fields;
}

/**
 * Get data type of a value
 */
function getDataType(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'unknown';
}

/**
 * Analyze Shopee product structure
 */
export function analyzeShopeeFields(): PlatformFieldMap {
  const productDetail = shopeeData.shopee_product_detail_response.response;
  const variantList = shopeeData.shopee_variant_list_response.response;
  
  console.log('🔍 Analyzing Shopee API Structure...\n');
  
  // Extract product fields
  const productFields = extractFields(productDetail, 'product');
  console.log('📦 Shopee Product Fields:');
  Object.keys(productFields).forEach(field => {
    const value = productFields[field];
    console.log(`  ${field}: ${getDataType(value)} = ${JSON.stringify(value).substring(0, 50)}${JSON.stringify(value).length > 50 ? '...' : ''}`);
  });
  
  // Extract variant fields
  if (variantList.model && variantList.model.length > 0) {
    const variantFields = extractFields(variantList.model[0], 'variant');
    console.log('\n🎨 Shopee Variant Fields:');
    Object.keys(variantFields).forEach(field => {
      const value = variantFields[field];
      console.log(`  ${field}: ${getDataType(value)} = ${JSON.stringify(value).substring(0, 50)}${JSON.stringify(value).length > 50 ? '...' : ''}`);
    });
    
    Object.assign(productFields, variantFields);
  }
  
  return productFields;
}

/**
 * Analyze TikTok Shop product structure
 */
export function analyzeTikTokFields(): PlatformFieldMap {
  const productDetail = tiktokData.tiktokshop_product_detail_response.data;
  const variantList = tiktokData.tiktokshop_variant_list_response.data;
  
  console.log('\n🔍 Analyzing TikTok Shop API Structure...\n');
  
  // Extract product fields
  const productFields = extractFields(productDetail, 'product');
  console.log('📦 TikTok Shop Product Fields:');
  Object.keys(productFields).forEach(field => {
    const value = productFields[field];
    console.log(`  ${field}: ${getDataType(value)} = ${JSON.stringify(value).substring(0, 50)}${JSON.stringify(value).length > 50 ? '...' : ''}`);
  });
  
  // Extract variant fields
  if (variantList.skus && variantList.skus.length > 0) {
    const variantFields = extractFields(variantList.skus[0], 'variant');
    console.log('\n🎨 TikTok Shop Variant Fields:');
    Object.keys(variantFields).forEach(field => {
      const value = variantFields[field];
      console.log(`  ${field}: ${getDataType(value)} = ${JSON.stringify(value).substring(0, 50)}${JSON.stringify(value).length > 50 ? '...' : ''}`);
    });
    
    Object.assign(productFields, variantFields);
  }
  
  return productFields;
}

/**
 * Compare fields between platforms
 */
export function compareFields(): FieldAnalysis[] {
  const shopeeFields = analyzeShopeeFields();
  const tiktokFields = analyzeTikTokFields();
  
  console.log('\n📊 Field Comparison Analysis...\n');
  
  const analysis: FieldAnalysis[] = [];
  const allFields = new Set([...Object.keys(shopeeFields), ...Object.keys(tiktokFields)]);
  
  allFields.forEach(fieldKey => {
    const shopeeValue = shopeeFields[fieldKey];
    const tiktokValue = tiktokFields[fieldKey];
    const hasShopee = shopeeValue !== undefined;
    const hasTikTok = tiktokValue !== undefined;
    
    let fieldName = fieldKey;
    let shopeeField = hasShopee ? fieldKey : undefined;
    let tiktokField = hasTikTok ? fieldKey : undefined;
    
    // Try to find similar fields with different names
    if (!hasShopee || !hasTikTok) {
      // Look for similar field names
      const similarFields = findSimilarFields(fieldKey, hasShopee ? tiktokFields : shopeeFields);
      if (similarFields.length > 0) {
        if (!hasShopee) {
          shopeeField = similarFields[0];
        }
        if (!hasTikTok) {
          tiktokField = similarFields[0];
        }
      }
    }
    
    const shopeeType = getDataType(shopeeValue);
    const tiktokType = getDataType(tiktokValue);
    const dataType = hasShopee && hasTikTok ? 
      (shopeeType === tiktokType ? shopeeType : `${shopeeType}/${tiktokType}`) :
      (hasShopee ? shopeeType : tiktokType);
    
    const isCommon = hasShopee && hasTikTok;
    const needsTransformation = isCommon && (shopeeType !== tiktokType || 
      JSON.stringify(shopeeValue) !== JSON.stringify(tiktokValue));
    
    let notes = '';
    if (isCommon) {
      if (needsTransformation) {
        notes = `Different types or values: Shopee(${shopeeType}) vs TikTok(${tiktokType})`;
      } else {
        notes = 'Compatible across platforms';
      }
    } else if (hasShopee) {
      notes = 'Shopee-specific field';
    } else {
      notes = 'TikTok Shop-specific field';
    }
    
    analysis.push({
      fieldName,
      shopeeField,
      tiktokField,
      shopeeValue,
      tiktokValue,
      dataType,
      isCommon,
      needsTransformation,
      notes
    });
  });
  
  return analysis;
}

/**
 * Find similar field names
 */
function findSimilarFields(targetField: string, fields: PlatformFieldMap): string[] {
  const target = targetField.toLowerCase();
  const similar: string[] = [];
  
  Object.keys(fields).forEach(field => {
    const fieldLower = field.toLowerCase();
    
    // Check for exact matches in different parts
    if (fieldLower.includes(target) || target.includes(fieldLower)) {
      similar.push(field);
    }
    
    // Check for semantic matches
    const semanticMatches: { [key: string]: string[] } = {
      'id': ['product_id', 'item_id'],
      'name': ['product_name', 'item_name'],
      'weight': ['package_weight'],
      'dimensions': ['package_dimensions'],
      'status': ['product_status', 'item_status'],
      'images': ['image'],
      'brand': ['brand_name']
    };
    
    Object.keys(semanticMatches).forEach(semantic => {
      if (target.includes(semantic) && semanticMatches[semantic].some(match => fieldLower.includes(match))) {
        similar.push(field);
      }
    });
  });
  
  return [...new Set(similar)]; // Remove duplicates
}

/**
 * Generate field mapping report
 */
export function generateFieldMappingReport(): void {
  console.log('🔍 SyncStore Field Mapping Analysis Report\n');
  console.log('==========================================\n');
  
  const analysis = compareFields();
  
  // Categorize fields
  const commonFields = analysis.filter(f => f.isCommon);
  const shopeeOnlyFields = analysis.filter(f => f.shopeeField && !f.tiktokField);
  const tiktokOnlyFields = analysis.filter(f => f.tiktokField && !f.shopeeField);
  const transformationNeeded = analysis.filter(f => f.needsTransformation);
  
  console.log('📊 Summary Statistics:');
  console.log(`Total Fields Analyzed: ${analysis.length}`);
  console.log(`Common Fields: ${commonFields.length} (${Math.round(commonFields.length / analysis.length * 100)}%)`);
  console.log(`Shopee-Only Fields: ${shopeeOnlyFields.length} (${Math.round(shopeeOnlyFields.length / analysis.length * 100)}%)`);
  console.log(`TikTok-Only Fields: ${tiktokOnlyFields.length} (${Math.round(tiktokOnlyFields.length / analysis.length * 100)}%)`);
  console.log(`Fields Needing Transformation: ${transformationNeeded.length}\n`);
  
  console.log('✅ Common Fields (Both Platforms):');
  commonFields.forEach(field => {
    const status = field.needsTransformation ? '⚠️  Needs transformation' : '✓ Compatible';
    console.log(`  ${field.fieldName}: ${field.dataType} - ${status}`);
  });
  
  console.log('\n🟦 Shopee-Only Fields:');
  shopeeOnlyFields.forEach(field => {
    console.log(`  ${field.fieldName}: ${field.dataType} - ${field.notes}`);
  });
  
  console.log('\n🟪 TikTok Shop-Only Fields:');
  tiktokOnlyFields.forEach(field => {
    console.log(`  ${field.fieldName}: ${field.dataType} - ${field.notes}`);
  });
  
  if (transformationNeeded.length > 0) {
    console.log('\n⚠️  Fields Requiring Transformation:');
    transformationNeeded.forEach(field => {
      console.log(`  ${field.fieldName}:`);
      console.log(`    Shopee: ${getDataType(field.shopeeValue)} = ${JSON.stringify(field.shopeeValue)}`);
      console.log(`    TikTok: ${getDataType(field.tiktokValue)} = ${JSON.stringify(field.tiktokValue)}`);
      console.log(`    Notes: ${field.notes}\n`);
    });
  }
  
  console.log('🎯 Recommendations:');
  console.log('1. Focus on common fields for master schema design');
  console.log('2. Store platform-specific fields in separate mapping objects');
  console.log('3. Implement transformation functions for incompatible common fields');
  console.log('4. Validate actual API responses match this analysis');
  console.log('\n✅ Analysis Complete - Ready for Master Schema Design');
}

/**
 * Export analysis data for further processing
 */
export function exportAnalysisData(): {
  shopeeFields: PlatformFieldMap;
  tiktokFields: PlatformFieldMap;
  analysis: FieldAnalysis[];
} {
  const shopeeFields = analyzeShopeeFields();
  const tiktokFields = analyzeTikTokFields();
  const analysis = compareFields();
  
  return {
    shopeeFields,
    tiktokFields,
    analysis
  };
}