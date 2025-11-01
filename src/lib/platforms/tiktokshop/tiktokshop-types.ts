/**
 * TikTok Shop Platform Types
 * Type definitions specific to TikTok Shop API
 */

import { PlatformCredentials } from '../types';

export interface TikTokShopCredentials extends PlatformCredentials {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
  shopId?: string;
}

export interface TikTokShopApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  request_id?: string;
}

// Product types
export interface TikTokShopProduct {
  id: string;
  title: string;
  description: string;
  category_id: string;
  brand_id?: string;
  images: TikTokShopImage[];
  video?: TikTokShopVideo;
  skus: TikTokShopSku[];
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'LIVE' | 'SELLER_DEACTIVATED' | 'PLATFORM_DEACTIVATED' | 'FREEZE';
  create_time: number;
  update_time: number;
  product_certifications?: TikTokShopCertification[];
  size_chart?: TikTokShopSizeChart;
  package_weight?: number;
  package_dimensions?: TikTokShopDimensions;
  delivery_options?: TikTokShopDeliveryOption[];
  is_cod_allowed?: boolean;
}

export interface TikTokShopSku {
  id: string;
  seller_sku?: string;
  price: TikTokShopPrice;
  inventory: TikTokShopInventory[];
  sales_attributes: TikTokShopSalesAttribute[];
  identifier_code?: {
    type: 'EAN' | 'UPC' | 'ISBN';
    code: string;
  };
}

export interface TikTokShopPrice {
  currency: string;
  amount: string;
  tax_exclusive_amount?: string;
}

export interface TikTokShopInventory {
  warehouse_id: string;
  quantity: number;
}

export interface TikTokShopSalesAttribute {
  attribute_id: string;
  attribute_name: string;
  value_id: string;
  value_name: string;
  sku_img?: TikTokShopImage;
}

export interface TikTokShopImage {
  id: string;
  url: string;
  thumb_urls?: string[];
  alt_text?: string;
}

export interface TikTokShopVideo {
  id: string;
  url: string;
  cover?: TikTokShopImage;
  duration?: number;
}

export interface TikTokShopCertification {
  id: string;
  title: string;
  files: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}

export interface TikTokShopSizeChart {
  template: {
    id: string;
    name: string;
  };
  image?: TikTokShopImage;
}

export interface TikTokShopDimensions {
  length: string;
  width: string;
  height: string;
  unit: 'CM' | 'INCH';
}

export interface TikTokShopDeliveryOption {
  delivery_option_id: string;
  delivery_option_name: string;
  is_available: boolean;
}

export interface TikTokShopProductRequest {
  title: string;
  description: string;
  category_id: string;
  brand_id?: string;
  images: Array<{
    id: string;
  }>;
  video?: {
    id: string;
  };
  skus: Array<{
    seller_sku?: string;
    price: {
      currency: string;
      amount: string;
    };
    inventory: Array<{
      warehouse_id: string;
      quantity: number;
    }>;
    sales_attributes?: Array<{
      attribute_id: string;
      value_id: string;
      sku_img?: {
        id: string;
      };
    }>;
    identifier_code?: {
      type: 'EAN' | 'UPC' | 'ISBN';
      code: string;
    };
  }>;
  product_certifications?: Array<{
    id: string;
  }>;
  size_chart?: {
    template: {
      id: string;
    };
    image?: {
      id: string;
    };
  };
  package_weight?: number;
  package_dimensions?: TikTokShopDimensions;
  delivery_options?: Array<{
    delivery_option_id: string;
  }>;
  is_cod_allowed?: boolean;
}

export interface TikTokShopInventoryUpdateRequest {
  product_id: string;
  skus: Array<{
    id: string;
    inventory: Array<{
      warehouse_id: string;
      quantity: number;
    }>;
  }>;
}

// Order types
export interface TikTokShopOrder {
  id: string;
  status: 'UNPAID' | 'AWAITING_SHIPMENT' | 'AWAITING_COLLECTION' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  create_time: number;
  update_time: number;
  buyer_message?: string;
  cancel_reason?: string;
  cancel_user?: 'BUYER' | 'SELLER' | 'SYSTEM';
  fulfillment_type: 'FULFILLED_BY_SELLER' | 'FULFILLED_BY_TIKTOKSHOP';
  warehouse_id?: string;
  collection_due_time?: number;
  delivery_due_time?: number;
  buyer_info: TikTokShopBuyer;
  recipient_info: TikTokShopRecipient;
  delivery_info: TikTokShopDelivery;
  order_lines: TikTokShopOrderLine[];
  payment_info: TikTokShopPayment;
  promotion_info?: TikTokShopPromotion;
  split_or_combined_by_tts?: boolean;
  is_sample_order?: boolean;
  is_replacement_order?: boolean;
  replacement_previous_order_id?: string;
  cpf?: string;
}

export interface TikTokShopBuyer {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface TikTokShopRecipient {
  name: string;
  phone: string;
  address: {
    full_address: string;
    region_code: string;
    region: string;
    state: string;
    city: string;
    district?: string;
    town?: string;
    postal_code: string;
  };
}

export interface TikTokShopDelivery {
  delivery_option_id: string;
  delivery_option_name: string;
  delivery_option_description?: string;
  shipping_provider_id?: string;
  shipping_provider_name?: string;
  tracking_number?: string;
}

export interface TikTokShopOrderLine {
  id: string;
  product_id: string;
  product_name: string;
  sku_id: string;
  sku_name?: string;
  sku_image?: TikTokShopImage;
  seller_sku?: string;
  quantity: number;
  sale_price: TikTokShopPrice;
  original_price: TikTokShopPrice;
  platform_discount?: TikTokShopPrice;
  seller_discount?: TikTokShopPrice;
  tax_amount?: TikTokShopPrice;
  is_gift?: boolean;
  package_status?: 'AWAITING_SHIPMENT' | 'SHIPPED' | 'DELIVERED';
  package_id?: string;
  rtv_pending?: boolean;
  must_attend_delivery?: boolean;
}

export interface TikTokShopPayment {
  currency: string;
  total_amount: TikTokShopPrice;
  sub_total: TikTokShopPrice;
  tax_amount?: TikTokShopPrice;
  shipping_fee?: TikTokShopPrice;
  shipping_fee_seller_discount?: TikTokShopPrice;
  shipping_fee_platform_discount?: TikTokShopPrice;
  retail_delivery_fee?: TikTokShopPrice;
  buyer_service_fee?: TikTokShopPrice;
  taxes?: Array<{
    type: string;
    amount: TikTokShopPrice;
  }>;
}

export interface TikTokShopPromotion {
  platform_promotions?: Array<{
    id: string;
    name: string;
    discount_amount: TikTokShopPrice;
  }>;
  seller_promotions?: Array<{
    id: string;
    name: string;
    discount_amount: TikTokShopPrice;
  }>;
}

// Webhook types
export interface TikTokShopWebhookPayload {
  timestamp: number;
  shop_id: string;
  type: string;
  data: any;
}

// Authentication types
export interface TikTokShopAuthResponse {
  access_token: string;
  access_token_expire_in: number;
  refresh_token: string;
  refresh_token_expire_in: number;
  open_id: string;
  seller_name: string;
  seller_base_region: string;
  user_type: number;
  granted_scopes: string[];
}

export interface TikTokShopTokenRefreshRequest {
  app_key: string;
  app_secret: string;
  refresh_token: string;
  grant_type: 'refresh_token';
}

// Error types
export interface TikTokShopError {
  code: number;
  message: string;
  detail?: string;
}

// Category types
export interface TikTokShopCategory {
  id: string;
  parent_id: string;
  local_name: string;
  is_leaf: boolean;
  children?: TikTokShopCategory[];
}

// Brand types
export interface TikTokShopBrand {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// Attribute types
export interface TikTokShopAttribute {
  id: string;
  name: string;
  type: 'TEXT' | 'SINGLE_SELECT' | 'MULTIPLE_SELECT' | 'DATE' | 'DATETIME' | 'INT' | 'FLOAT';
  is_required: boolean;
  is_customizable: boolean;
  values?: Array<{
    id: string;
    name: string;
  }>;
}

// Logistics types
export interface TikTokShopLogistics {
  delivery_options: TikTokShopDeliveryOption[];
  warehouses: Array<{
    id: string;
    name: string;
    address: {
      region_code: string;
      state: string;
      city: string;
      district: string;
      full_address: string;
    };
  }>;
}

// File upload types
export interface TikTokShopFileUploadResponse {
  files: Array<{
    id: string;
    name: string;
    url: string;
    width?: number;
    height?: number;
  }>;
}

// Fulfillment types
export interface TikTokShopFulfillmentRequest {
  order_id: string;
  order_line_ids?: string[];
  tracking_number?: string;
  provider_id?: string;
}

// Return types
export interface TikTokShopReturn {
  id: string;
  order_id: string;
  order_line_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  type: 'RETURN' | 'REFUND' | 'EXCHANGE';
  reason: string;
  create_time: number;
  update_time: number;
}