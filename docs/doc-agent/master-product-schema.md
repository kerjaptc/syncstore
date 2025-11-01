# SyncStore - Master Product Schema Template
## Field Mapping & Data Structure Reference

**Document Version:** 1.0  
**Date:** November 1, 2025  
**Purpose:** Template for understanding product data structure across platforms  

---

## Quick Reference: Platform Comparison

| Field | Shopee | TikTok Shop | Tokopedia | Notes |
|-------|--------|-------------|-----------|-------|
| Product Title | ✓ Required | ✓ Required | ✓ Auto | Max 120 chars for SEO |
| Description | ✓ Required | ✓ Required | ✓ Auto | Different formatting per platform |
| Images | ✓ Required | ✓ Required | ✓ Auto | Min 3, Max varies by platform |
| Price | ✓ Required | ✓ Required | ✓ Auto | Dynamic based on platform fee |
| Weight | ✓ Optional | ✓ Optional | ✓ Auto | For shipping calculation |
| Dimensions | ✓ Optional | ✓ Optional | ✓ Auto | L x W x H in cm |
| Category | ✓ Required | ✓ Required | ✓ Auto | Different category IDs per platform |
| Variants | ✓ Optional | ✓ Optional | ✓ Auto | Color, Size, Material, etc. |
| Shipping Template | ✓ Platform-specific | ❌ Not used | ✓ Auto | Courier options per platform |
| SKU | ✓ Optional | ✓ Optional | ✓ Auto | Master SKU tracked internally |
| Pre-order Info | ✓ In description | ✓ In description | ✓ Auto | "5-day preorder" messaging |

---

## Master Product Schema - Detailed Breakdown

### 1. Universal/Common Fields

These fields must be present and synced across ALL platforms.

```json
{
  "Universal Fields": {
    "product_id": "uuid",
    "sku": "master_sku_unique",
    "title": "Product Name - Main Title",
    "short_description": "One-line summary",
    "full_description": "Detailed description with specs",
    "status": "active|inactive|archived",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-11-01T14:20:00Z"
  },

  "Pricing": {
    "base_price": 150000,
    "cost_price": 75000,
    "markup_percentage": 100,
    "currency": "IDR"
  },

  "Physical Specs": {
    "weight_kg": 0.05,
    "dimensions": {
      "length_cm": 22,
      "width_cm": 22,
      "height_cm": 3
    }
  },

  "Media": {
    "images": [
      {
        "url": "https://cdn.motekarfpv.com/product-1-main.jpg",
        "alt": "Frame Racing 5 Inch - Top View",
        "position": 1,
        "primary": true
      },
      {
        "url": "https://cdn.motekarfpv.com/product-1-side.jpg",
        "alt": "Frame Racing 5 Inch - Side View",
        "position": 2,
        "primary": false
      }
    ]
  },

  "Categorization": {
    "category": "drone_parts",
    "subcategory": "frames",
    "tags": ["5inch", "racing", "carbon", "lightweight"]
  }
}
```

### 2. Variant Structure (if applicable)

For products with variations (color, size, material, etc.)

```json
{
  "variants": [
    {
      "variant_id": "uuid",
      "variant_sku": "FRAME-5IN-RED",
      "name": "Color: Red",
      "attributes": {
        "color": "Red",
        "material": "Carbon Fiber",
        "weight": "50g"
      },
      "price_override": null,
      "images": [
        {
          "url": "https://cdn.motekarfpv.com/product-1-red.jpg",
          "alt": "Frame 5 Inch - Red"
        }
      ]
    },
    {
      "variant_id": "uuid",
      "variant_sku": "FRAME-5IN-BLUE",
      "name": "Color: Blue",
      "attributes": {
        "color": "Blue",
        "material": "Carbon Fiber",
        "weight": "50g"
      },
      "price_override": null,
      "images": [
        {
          "url": "https://cdn.motekarfpv.com/product-1-blue.jpg",
          "alt": "Frame 5 Inch - Blue"
        }
      ]
    }
  ]
}
```

### 3. Platform-Specific Mappings

#### Shopee Mapping

```json
{
  "shopee": {
    "sync_enabled": true,
    "item_id": "123456789",
    "shop_id": "987654321",
    "category_id": "100001",
    
    "pricing": {
      "platform_fee_percentage": 15,
      "payment_fee_percentage": 2.9,
      "calculated_price": 172500,
      "formula": "base_price * 1.15"
    },

    "seo_optimization": {
      "platform_title": "Frame Racing Drone 5 Inch Carbon Fiber Ringan - Grosir Ready [BEST SELLER]",
      "title_keywords": ["5inch", "frame", "racing", "carbon"],
      "notes": "Added 'Ringan' (light), '[BEST SELLER]' for Shopee algorithm"
    },

    "shipping": {
      "shipping_template_id": "template_1",
      "couriers": ["J&T", "JNE", "SiCepat"],
      "preorder_days": 5,
      "preorder_description": "Pre-order 5 hari (biasanya selesai 1-3 hari)"
    },

    "variants": [
      {
        "master_variant_sku": "FRAME-5IN-RED",
        "shopee_model_id": "300001",
        "shopee_sku": "shopee-red"
      },
      {
        "master_variant_sku": "FRAME-5IN-BLUE",
        "shopee_model_id": "300002",
        "shopee_sku": "shopee-blue"
      }
    ],

    "sync_status": "synced",
    "last_synced_at": "2025-11-01T10:00:00Z",
    "sync_errors": null
  }
}
```

#### TikTok Shop Mapping

```json
{
  "tiktokshop": {
    "sync_enabled": true,
    "include_tokopedia": true,
    "product_id": "TTS-456789",
    "shop_id": "TTS-SHOP-123",
    "category_id": "electronics-456",
    
    "pricing": {
      "platform_fee_percentage": 20,
      "payment_fee_percentage": 2.5,
      "calculated_price": 180000,
      "formula": "base_price * 1.20"
    },

    "seo_optimization": {
      "platform_title": "Racing Frame 5 Inch Carbon - Ringan & Kuat untuk Drone FPV",
      "title_keywords": ["racing", "5inch", "drone", "fpv"],
      "notes": "TikTok audience younger, added 'Kuat' (strong), drone-focused keywords"
    },

    "tokopedia_info": {
      "enabled": true,
      "tokopedia_product_id": "TOKOPEDIA-789",
      "tokopedia_category_id": "100-electronics",
      "synced_at": "2025-11-01T10:00:00Z"
    },

    "shipping": {
      "fulfillment_type": "SELLER_FULFILLMENT",
      "couriers": ["J&T", "JNE", "SiCepat"],
      "preorder_days": 5,
      "preorder_description": "Pre-order 5 hari (biasanya 1-3 hari)"
    },

    "variants": [
      {
        "master_variant_sku": "FRAME-5IN-RED",
        "tiktok_variant_id": "TTS-VAR-001",
        "tokopedia_variant_id": "TOK-VAR-001"
      },
      {
        "master_variant_sku": "FRAME-5IN-BLUE",
        "tiktok_variant_id": "TTS-VAR-002",
        "tokopedia_variant_id": "TOK-VAR-002"
      }
    ],

    "sync_status": "synced",
    "last_synced_at": "2025-11-01T10:00:00Z",
    "sync_errors": null
  }
}
```

#### Website Mapping (Future)

```json
{
  "website": {
    "sync_enabled": false,
    "slug": "frame-racing-5-inch-carbon",
    "url": "https://motekarfpv.com/products/frame-racing-5-inch-carbon",

    "pricing": {
      "platform_fee_percentage": 0,
      "payment_fee_percentage": 2.9,
      "calculated_price": 150000,
      "notes": "No marketplace fee - direct sales benefit"
    },

    "seo_optimization": {
      "page_title": "5-Inch Racing Drone Frame - Premium Carbon Fiber | Motekar FPV",
      "meta_description": "High-performance racing drone frame for FPV enthusiasts. Pre-order with fast delivery.",
      "keywords": ["racing frame", "5 inch drone", "FPV parts", "carbon fiber"]
    },

    "custom_fields": {
      "print_time_days": "2-3 days (standard 5-day promise)",
      "material_type": "PLA+ Carbon Fiber Reinforced",
      "infill_percentage": "20%",
      "production_notes": "Custom manufactured per order"
    },

    "shipping": {
      "local_only": false,
      "international_enabled": false,
      "shipping_cost": "dynamic_per_courier"
    },

    "sync_status": "not_started",
    "notes": "Website integration planned for Phase 3"
  }
}
```

---

## Data Import Field Checklist

Use this checklist during data import to validate completeness:

### Required Fields (MUST have)
- [x] Product Title (non-empty)
- [x] Price (> 0)
- [x] At least 1 image (accessible URL)
- [x] Category (valid category ID)
- [x] Platform ID (Shopee item_id or TikTok product_id)

### Recommended Fields (SHOULD have)
- [x] Description (helpful for customer)
- [x] Weight (for shipping calculation)
- [x] Dimensions (for package sizing)
- [x] Multiple images (minimum 3)
- [x] Variants (if applicable)

### Optional Fields (NICE to have)
- [x] Pre-order information
- [x] Bulk pricing (for B2B)
- [x] Custom attributes (material, color details)
- [x] Video/tutorial links
- [x] Customer reviews (import if available)

### Platform-Specific Required
- **Shopee:** `category_id`, `shipping_template_id`
- **TikTok Shop:** `category_id`, `fulfillment_type`
- **Website:** `slug`, `meta_description`

---

## Example: Complete Product Record

```json
{
  "id": "prod_12345",
  "sku": "FRAME-5IN",
  "title": "Frame Racing Drone 5 Inch",
  "short_description": "Lightweight carbon fiber frame for FPV racing",
  "full_description": "Professional-grade 5-inch racing drone frame...",
  
  "pricing": {
    "base_price": 150000,
    "cost_price": 75000,
    "currency": "IDR"
  },

  "physical_specs": {
    "weight_kg": 0.05,
    "dimensions": {
      "length_cm": 22,
      "width_cm": 22,
      "height_cm": 3
    }
  },

  "images": [
    {
      "url": "https://cdn/frame-main.jpg",
      "alt": "Frame 5 Inch - Top View",
      "position": 1,
      "primary": true
    }
  ],

  "categorization": {
    "category": "drone_parts",
    "subcategory": "frames",
    "tags": ["5inch", "racing", "carbon", "fpv"]
  },

  "variants": [
    {
      "variant_sku": "FRAME-5IN-RED",
      "name": "Color: Red",
      "attributes": {"color": "Red"}
    }
  ],

  "platform_mappings": {
    "shopee": {
      "item_id": "123456789",
      "category_id": "100001",
      "pricing": {
        "fee_percentage": 15,
        "calculated_price": 172500
      },
      "sync_status": "synced"
    },
    "tiktokshop": {
      "product_id": "TTS-456789",
      "category_id": "electronics-456",
      "include_tokopedia": true,
      "pricing": {
        "fee_percentage": 20,
        "calculated_price": 180000
      },
      "sync_status": "synced"
    }
  },

  "sync_metadata": {
    "status": "active",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-11-01T14:20:00Z",
    "last_synced_at": "2025-11-01T10:00:00Z"
  }
}
```

---

## Import CSV Template

For manual bulk import if needed:

```csv
sku,title,base_price,weight_kg,category,tags,shopee_item_id,shopee_model_ids,tiktok_product_id,description
FRAME-5IN,Frame Racing 5 Inch,150000,0.05,frames,"5inch,racing,carbon","123456789","300001|300002","TTS-456789","Professional racing frame"
PROP-9INCH,Propeller 9 Inch,50000,0.02,propellers,"9inch,prop","987654321","300003","TTS-456790","High-performance propeller"
BATTERY-4S,Battery 4S 1500mAh,250000,0.35,batteries,"4s,1500mah,lipo","456789123","300004|300005","TTS-456791","Lightweight LiPo battery"
```

---

## Pricing Calculation Examples

### Example 1: Simple Product (No Variants)

```
Product: "Frame Racing 5 Inch"
Master Price: Rp 150,000

Shopee:
  Fee: 15%
  Price: 150,000 × 1.15 = Rp 172,500

TikTok/Tokopedia:
  Fee: 20%
  Price: 150,000 × 1.20 = Rp 180,000

Website:
  Fee: 0%
  Price: Rp 150,000
  (Direct sales, no marketplace fee)
```

### Example 2: Product with Variants

```
Product: "Frame Racing 5 Inch - Color Variant"

Master Price: Rp 150,000 (base)
Variant Price Override: None (use base)

Shopee (Red):
  Item ID: 123456789
  Model ID: 300001
  Price: Rp 172,500

Shopee (Blue):
  Item ID: 123456789
  Model ID: 300002
  Price: Rp 172,500

TikTok (Red):
  Variant ID: TTS-VAR-001
  Price: Rp 180,000

TikTok (Blue):
  Variant ID: TTS-VAR-002
  Price: Rp 180,000
```

### Example 3: Dynamic Fee Adjustment

```
If Shopee fee changes from 15% to 12%:
  Old Price: 150,000 × 1.15 = 172,500
  New Price: 150,000 × 1.12 = 168,000
  Adjustment: -4,500 per item

Update in Master Schema:
  platform_mappings.shopee.platform_fee_percentage = 12

System automatically recalculates all Shopee prices.
```

---

## SEO Title Variation Strategy

### Rule: Keep 70-80% similar, vary 20-30%

#### Product: "Frame Racing 5 Inch Carbon Fiber"

**Master (Internal):** 
```
Frame Racing 5 Inch Carbon Fiber
```

**Shopee Title (Search-heavy, urgency):**
```
Frame 5 Inch Racing Carbon Fiber Ringan - Grosir Ready [BEST SELLER]
```
Changes:
- Reordered words for SEO priority
- Added "Ringan" (light) = product benefit
- Added "Grosir Ready" = volume buyers
- Added "[BEST SELLER]" = social proof

**TikTok Title (Audience-driven, storytelling):**
```
Racing Frame 5 Inch Carbon - Ringan & Kuat Banget untuk FPV
```
Changes:
- "Racing Frame" first (action-oriented)
- Added "Kuat" (strong) = durability
- Added "untuk FPV" = clear use case
- Casual language ("Banget") = TikTok vibe

**Website Title (Professional, SEO-optimized):**
```
5-Inch Racing Drone Frame - Premium Carbon Fiber | Motekar FPV
```
Changes:
- Number first for search
- Professional language
- Brand name "Motekar FPV"
- Clear value proposition "Premium"

---

**Last Updated:** November 1, 2025  
**Ready for:** Phase 1 Data Import Implementation
