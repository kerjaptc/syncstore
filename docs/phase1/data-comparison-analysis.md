# Data Comparison Analysis Report

**Generated:** 2025-11-01T16:28:52.919Z  
**Analysis Version:** 1.0.0

## Executive Summary

This report analyzes the imported product data from Shopee and TikTok Shop platforms to identify overlaps, differences, and data quality metrics. The analysis is crucial for designing the master product schema and ensuring data integrity for the SyncStore system.

## Product Overlap Analysis

### Overview
- **Shopee Products:** 2
- **TikTok Shop Products:** 2
- **Common Products:** 1
- **Overlap Percentage:** 50%

### Platform-Specific Products
- **Shopee Only:** 1 products
- **TikTok Shop Only:** 1 products

### Similar Products Found
1 product pairs were identified as similar based on:
- Title similarity (40% weight)
- Price similarity (20% weight)
- Category matching (20% weight)
- Weight similarity (10% weight)
- Image count similarity (10% weight)

## Field Mapping Analysis

### Overview
- **Common Fields:** 2
- **Shopee-Only Fields:** 1
- **TikTok-Only Fields:** 2
- **Field Overlap Percentage:** 75%

### Top Common Fields
1. **price** - 100% match (number)
2. **weight** - 100% match (number)

### Platform-Specific Fields

#### Shopee-Only Fields
1. **item_id** - string (2 products)

#### TikTok-Only Fields
1. **product_id** - string (2 products)
2. **include_tokopedia** - boolean (2 products)

## Data Quality Analysis

### Overall Quality
- **Total Products:** 4
- **Valid Products:** 4
- **Quality Score:** 100%

### Shopee Data Quality
- **Total Products:** 2
- **Valid Products:** 2
- **Quality Score:** 100%
- **Missing Required Fields:** 0
- **Invalid Prices:** 0
- **Missing Images:** 0

### TikTok Shop Data Quality
- **Total Products:** 2
- **Valid Products:** 2
- **Quality Score:** 100%
- **Missing Required Fields:** 0
- **Invalid Prices:** 0
- **Missing Images:** 0
- **Tokopedia Enabled:** 1

## Recommendations

1. Field overlap (75%) is below 90% target - create field mapping strategy
2. Product overlap meets requirements - ready for master schema design

## Next Steps

1. Design master product schema based on analysis results
2. Implement platform-specific mapping structures
3. Create pricing calculation system with platform fees

## Technical Details

### Analysis Configuration
- **Shopee Data Path:** ./data/raw-imports/shopee
- **TikTok Data Path:** ./data/raw-imports/tiktokshop
- **Similarity Threshold:** 70% (for product matching)
- **Field Match Threshold:** 80% (for field compatibility)

### Methodology
1. **Product Matching:** Uses multi-factor similarity scoring including title, price, category, weight, and image count
2. **Field Analysis:** Recursive field extraction with data type detection and frequency analysis
3. **Quality Assessment:** Validates required fields (title, price, images) and data integrity

---

*This report was generated automatically by the SyncStore Data Analyzer v1.0.0*
