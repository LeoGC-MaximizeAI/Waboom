/**
 * Customer Data Types
 * Normalized customer profile structure from Klaviyo
 */

// Raw Klaviyo profile structure (input)
export interface KlaviyoProfile {
  id: string;
  type: 'profile';
  attributes: {
    email?: string;
    phone_number?: string;
    external_id?: string;
    first_name?: string;
    last_name?: string;
    organization?: string;
    title?: string;
    image?: string;
    created?: string;
    updated?: string;
    last_event_date?: string;
    location?: {
      address1?: string;
      address2?: string;
      city?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      region?: string;
      zip?: string;
      timezone?: string;
    };
    properties?: Record<string, unknown>;
  };
  relationships?: {
    lists?: { data: Array<{ type: string; id: string }> };
    segments?: { data: Array<{ type: string; id: string }> };
  };
}

// Raw Klaviyo event structure
export interface KlaviyoEvent {
  id: string;
  type: 'event';
  attributes: {
    metric_id: string;
    profile_id: string;
    timestamp: string;
    event_properties: {
      $value?: number;
      $event_id?: string;
      ProductName?: string;
      ProductID?: string;
      Categories?: string[];
      Quantity?: number;
      DiscountCode?: string;
      DiscountValue?: number;
      ItemPrice?: number;
      [key: string]: unknown;
    };
    datetime: string;
    uuid: string;
  };
}

// Normalized customer profile (processed)
export interface CustomerProfile {
  // Identifiers
  profile_id: string;
  email: string;
  phone?: string;
  external_id?: string;

  // Demographics
  first_name?: string;
  last_name?: string;
  full_name?: string;
  organization?: string;
  title?: string;

  // Location
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  zip?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  last_event_date?: Date;

  // Order metrics
  order_count: number;
  total_revenue: number;
  average_order_value: number;
  first_order_date?: Date;
  last_order_date?: Date;
  days_since_last_order: number;
  avg_days_between_orders: number;

  // Product/Category affinity
  purchased_categories: string[];
  purchased_products: string[];
  top_category?: string;
  category_affinity_scores: Record<string, number>;

  // Discount behavior
  orders_with_discount: number;
  total_discount_amount: number;
  average_discount: number;
  discount_rate: number; // percentage of orders with discount

  // Engagement metrics
  email_open_count: number;
  email_click_count: number;
  email_bounce_count: number;
  sms_click_count: number;
  site_visits_last_90d: number;
  last_email_open_date?: Date;
  last_email_click_date?: Date;
  last_site_visit_date?: Date;

  // Predictive metrics (if available from Klaviyo)
  predicted_clv?: number;
  predicted_next_order_date?: Date;
  churn_risk_score?: number;

  // UTM/Acquisition data
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  acquisition_channel?: string;

  // Custom properties (extensible)
  custom_properties: Record<string, unknown>;

  // List/Segment memberships
  list_ids: string[];
  segment_ids: string[];
}

// Order summary for aggregation
export interface OrderSummary {
  order_id: string;
  profile_id: string;
  order_date: Date;
  total_value: number;
  discount_amount: number;
  discount_code?: string;
  items: OrderItem[];
  categories: string[];
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  categories: string[];
}

// Engagement event for aggregation
export interface EngagementEvent {
  event_id: string;
  profile_id: string;
  event_type: 'email_open' | 'email_click' | 'email_bounce' | 'sms_click' | 'site_visit' | 'page_view';
  timestamp: Date;
  campaign_id?: string;
  url?: string;
  properties?: Record<string, unknown>;
}

// Customer batch for processing
export interface CustomerBatch {
  batch_id: string;
  profiles: CustomerProfile[];
  batch_size: number;
  offset: number;
  total_count: number;
  has_more: boolean;
}
