/**
 * Shopee Platform Types
 * Type definitions specific to Shopee API
 */

import { PlatformCredentials } from '../types';

export interface ShopeeCredentials extends PlatformCredentials {
  partnerId: string;
  partnerKey: string;
  shopId: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface ShopeeApiResponse<T = any> {
  error?: string;
  message?: string;
  response?: T;
  request_id?: string;
}

// Product types
export interface ShopeeProduct {
  item_id: number;
  item_name: string;
  item_sku?: string;
  create_time: number;
  update_time: number;
  item_status: 'NORMAL' | 'DELETED' | 'BANNED' | 'UNLIST';
  has_model: boolean;
  promotion_id?: number;
  brand?: {
    brand_id: number;
    original_brand_name: string;
  };
  item_dangerous?: number;
  description?: {
    field_list: Array<{
      field_type: string;
      text?: string;
      image_info?: {
        image_id: string;
      };
    }>;
  };
  image?: {
    image_id_list: string[];
    image_url_list: string[];
  };
  weight?: number;
  dimension?: {
    package_length: number;
    package_width: number;
    package_height: number;
  };
  logistic_info?: Array<{
    logistic_id: number;
    logistic_name: string;
    enabled: boolean;
  }>;
  pre_order?: {
    is_pre_order: boolean;
    days_to_ship: number;
  };
  wholesales?: Array<{
    min_count: number;
    max_count: number;
    unit_price: number;
  }>;
  condition?: 'NEW' | 'USED';
  size_chart?: string;
  complaint_policy?: {
    warranty_time: number;
    exclude_entrepreneur_warranty: boolean;
    complaint_address_id: number;
    additional_information: string;
  };
  tax_info?: {
    ncm?: string;
    dta_value?: number;
    excise_duty?: number;
  };
  stock_info?: {
    stock_type: number;
    stock_location_id?: string;
    current_stock: number;
    normal_stock: number;
    reserved_stock: number;
  };
  price_info?: {
    currency: string;
    original_price: number;
    current_price: number;
    inflated_price_of_current_price?: number;
    inflated_price_of_original_price?: number;
    sip_item_price?: number;
    sip_item_price_source?: string;
  };
  model?: ShopeeProductVariant[];
}

export interface ShopeeProductVariant {
  model_id: number;
  promotion_id?: number;
  model_sku?: string;
  tier_index: number[];
  price_info?: {
    currency: string;
    original_price: number;
    current_price: number;
    inflated_price_of_current_price?: number;
    inflated_price_of_original_price?: number;
  };
  stock_info?: {
    stock_type: number;
    stock_location_id?: string;
    current_stock: number;
    normal_stock: number;
    reserved_stock: number;
  };
  model_name?: string;
}

export interface ShopeeProductRequest {
  item_name: string;
  description?: {
    field_list: Array<{
      field_type: 'text' | 'image';
      text?: string;
      image_info?: {
        image_id: string;
      };
    }>;
  };
  item_sku?: string;
  category_id: number;
  brand?: {
    brand_id: number;
  };
  image: {
    image_id_list: string[];
  };
  weight?: number;
  dimension?: {
    package_length: number;
    package_width: number;
    package_height: number;
  };
  logistic_info: Array<{
    logistic_id: number;
    enabled: boolean;
  }>;
  pre_order?: {
    is_pre_order: boolean;
    days_to_ship: number;
  };
  condition?: 'NEW' | 'USED';
  size_chart?: string;
  item_dangerous?: number;
  complaint_policy?: {
    warranty_time: number;
    exclude_entrepreneur_warranty: boolean;
    complaint_address_id: number;
    additional_information: string;
  };
  tax_info?: {
    ncm?: string;
    dta_value?: number;
    excise_duty?: number;
  };
  stock_info?: {
    stock_type: number;
    stock_location_id?: string;
    normal_stock: number;
  };
  price_info: {
    currency: string;
    original_price: number;
  };
  tier_variation?: Array<{
    name: string;
    option_list: Array<{
      option: string;
      image?: {
        image_id: string;
      };
    }>;
  }>;
  model?: Array<{
    tier_index: number[];
    stock_info?: {
      stock_type: number;
      stock_location_id?: string;
      normal_stock: number;
    };
    price_info?: {
      currency: string;
      original_price: number;
    };
    model_sku?: string;
  }>;
}

export interface ShopeeInventoryUpdateRequest {
  item_id: number;
  model_id?: number;
  normal_stock: number;
  stock_type?: number;
  stock_location_id?: string;
}

// Order types
export interface ShopeeOrder {
  order_sn: string;
  region: string;
  currency: string;
  cod: boolean;
  total_amount: number;
  order_status: 'UNPAID' | 'READY_TO_SHIP' | 'PROCESSED' | 'SHIPPED' | 'COMPLETED' | 'IN_CANCEL' | 'CANCELLED' | 'INVOICE_PENDING';
  shipping_carrier?: string;
  payment_method?: string;
  estimated_shipping_fee?: number;
  message_to_seller?: string;
  create_time: number;
  update_time: number;
  days_to_ship: number;
  ship_by_date: number;
  buyer_user_id: number;
  buyer_username: string;
  recipient_address?: {
    name: string;
    phone: string;
    town?: string;
    district?: string;
    city?: string;
    state?: string;
    region?: string;
    zipcode?: string;
    full_address?: string;
  };
  actual_shipping_fee?: number;
  goods_to_declare?: boolean;
  note?: string;
  note_update_time?: number;
  item_list?: ShopeeOrderItem[];
  pay_time?: number;
  dropshipper?: string;
  dropshipper_phone?: string;
  split_up?: boolean;
  buyer_cancel_reason?: string;
  cancel_by?: string;
  cancel_reason?: string;
  actual_shipping_fee_confirmed?: boolean;
  buyer_cpf_id?: string;
  fulfillment_flag?: string;
  pickup_done_time?: number;
  package_list?: Array<{
    package_number: string;
    logistics_status: string;
    shipping_carrier: string;
    item_list: Array<{
      item_id: number;
      model_id: number;
      model_quantity_purchased: number;
    }>;
  }>;
  invoice_data?: {
    number: string;
    series_number: string;
    access_key: string;
    issue_date: number;
    total_value: number;
    products_total_value: number;
    tax_total_value: number;
  };
}

export interface ShopeeOrderItem {
  item_id: number;
  item_name: string;
  item_sku?: string;
  model_id?: number;
  model_name?: string;
  model_sku?: string;
  model_quantity_purchased: number;
  model_original_price: number;
  model_discounted_price: number;
  wholesale?: boolean;
  weight?: number;
  add_on_deal?: boolean;
  main_item?: boolean;
  add_on_deal_id?: number;
  promotion_type?: string;
  promotion_id?: number;
  order_item_id?: number;
  promotion_group_id?: number;
  image_info?: {
    image_url: string;
  };
  product_location_id?: string[];
  is_prescription_item?: boolean;
  is_dts_item?: boolean;
}

// Webhook types
export interface ShopeeWebhookPayload {
  shop_id: number;
  timestamp: number;
  data: any;
  code: number;
}

// Authentication types
export interface ShopeeAuthResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  partner_id: number;
  shop_id: number;
  merchant_id?: number;
}

export interface ShopeeTokenRefreshRequest {
  refresh_token: string;
  partner_id: number;
  shop_id: number;
}

// Error types
export interface ShopeeError {
  error: string;
  message: string;
  request_id?: string;
}

// Common API parameters
export interface ShopeeCommonParams {
  partner_id: number;
  timestamp: number;
  access_token?: string;
  shop_id?: number;
  sign: string;
}

// Logistics types
export interface ShopeeLogistics {
  logistic_id: number;
  logistic_name: string;
  enabled: boolean;
  fee_type: string;
  size_list?: Array<{
    size_id: number;
    name: string;
    default_price: number;
  }>;
  weight_list?: Array<{
    weight_limit: number;
    default_price: number;
  }>;
  item_max_dimension?: {
    height: number;
    width: number;
    length: number;
    unit: string;
  };
  item_max_weight?: {
    weight: number;
    unit: string;
  };
}

// Category types
export interface ShopeeCategory {
  category_id: number;
  parent_category_id: number;
  original_category_name: string;
  display_category_name: string;
  has_children: boolean;
}

// Brand types
export interface ShopeeBrand {
  brand_id: number;
  original_brand_name: string;
  display_brand_name: string;
}

// Image upload types
export interface ShopeeImageUploadResponse {
  image_info: {
    image_id: string;
    image_url: string;
  };
}