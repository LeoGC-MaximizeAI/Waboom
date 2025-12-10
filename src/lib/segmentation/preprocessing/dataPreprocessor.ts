/**
 * Data Preprocessing Module
 * Normalizes Klaviyo data and derives secondary metrics
 */

import type {
  KlaviyoProfile,
  KlaviyoEvent,
  CustomerProfile,
  OrderSummary,
  EngagementEvent,
  OrderItem,
} from '../types/customer';

/**
 * Normalizes a raw Klaviyo profile into a standardized CustomerProfile
 */
export function normalizeProfile(
  rawProfile: KlaviyoProfile,
  events: KlaviyoEvent[] = [],
  currentDate: Date = new Date()
): CustomerProfile {
  const attrs = rawProfile.attributes;
  const props = attrs.properties || {};

  // Parse orders from events
  const orderEvents = events.filter(
    (e) => e.attributes.event_properties.$value !== undefined && e.attributes.event_properties.$value > 0
  );

  // Aggregate order metrics
  const orders = aggregateOrders(orderEvents);
  const orderMetrics = calculateOrderMetrics(orders, currentDate);

  // Aggregate engagement events
  const engagementEvents = categorizeEngagementEvents(events);
  const engagementMetrics = calculateEngagementMetrics(engagementEvents, currentDate);

  // Extract category affinity
  const categoryAffinity = calculateCategoryAffinity(orders);

  // Extract discount behavior
  const discountMetrics = calculateDiscountMetrics(orders);

  return {
    // Identifiers
    profile_id: rawProfile.id,
    email: attrs.email || '',
    phone: attrs.phone_number,
    external_id: attrs.external_id,

    // Demographics
    first_name: attrs.first_name,
    last_name: attrs.last_name,
    full_name: [attrs.first_name, attrs.last_name].filter(Boolean).join(' ') || undefined,
    organization: attrs.organization,
    title: attrs.title,

    // Location
    city: attrs.location?.city,
    region: attrs.location?.region,
    country: attrs.location?.country,
    timezone: attrs.location?.timezone,
    zip: attrs.location?.zip,

    // Timestamps
    created_at: new Date(attrs.created || currentDate),
    updated_at: new Date(attrs.updated || currentDate),
    last_event_date: attrs.last_event_date ? new Date(attrs.last_event_date) : undefined,

    // Order metrics
    order_count: orderMetrics.order_count,
    total_revenue: orderMetrics.total_revenue,
    average_order_value: orderMetrics.average_order_value,
    first_order_date: orderMetrics.first_order_date,
    last_order_date: orderMetrics.last_order_date,
    days_since_last_order: orderMetrics.days_since_last_order,
    avg_days_between_orders: orderMetrics.avg_days_between_orders,

    // Product/Category affinity
    purchased_categories: categoryAffinity.categories,
    purchased_products: categoryAffinity.products,
    top_category: categoryAffinity.top_category,
    category_affinity_scores: categoryAffinity.scores,

    // Discount behavior
    orders_with_discount: discountMetrics.orders_with_discount,
    total_discount_amount: discountMetrics.total_discount_amount,
    average_discount: discountMetrics.average_discount,
    discount_rate: discountMetrics.discount_rate,

    // Engagement metrics
    email_open_count: engagementMetrics.email_open_count,
    email_click_count: engagementMetrics.email_click_count,
    email_bounce_count: engagementMetrics.email_bounce_count,
    sms_click_count: engagementMetrics.sms_click_count,
    site_visits_last_90d: engagementMetrics.site_visits_last_90d,
    last_email_open_date: engagementMetrics.last_email_open_date,
    last_email_click_date: engagementMetrics.last_email_click_date,
    last_site_visit_date: engagementMetrics.last_site_visit_date,

    // Predictive metrics (from Klaviyo properties if available)
    predicted_clv: parseFloat(String(props.predicted_clv || props.CLV || 0)) || undefined,
    predicted_next_order_date: props.predicted_next_order_date
      ? new Date(String(props.predicted_next_order_date))
      : undefined,
    churn_risk_score: parseFloat(String(props.churn_risk || props.churn_risk_score || 0)) || undefined,

    // UTM/Acquisition data
    utm_source: String(props.$source || props.utm_source || ''),
    utm_medium: String(props.utm_medium || ''),
    utm_campaign: String(props.utm_campaign || ''),
    acquisition_channel: deriveAcquisitionChannel(props),

    // Custom properties
    custom_properties: props,

    // List/Segment memberships
    list_ids: rawProfile.relationships?.lists?.data.map((l) => l.id) || [],
    segment_ids: rawProfile.relationships?.segments?.data.map((s) => s.id) || [],
  };
}

/**
 * Aggregate order events into OrderSummary objects
 */
function aggregateOrders(orderEvents: KlaviyoEvent[]): OrderSummary[] {
  const orderMap = new Map<string, OrderSummary>();

  for (const event of orderEvents) {
    const props = event.attributes.event_properties;
    const orderId = props.$event_id || event.id;

    if (!orderMap.has(orderId)) {
      orderMap.set(orderId, {
        order_id: orderId,
        profile_id: event.attributes.profile_id,
        order_date: new Date(event.attributes.timestamp),
        total_value: props.$value || 0,
        discount_amount: props.DiscountValue || 0,
        discount_code: props.DiscountCode as string | undefined,
        items: [],
        categories: [],
      });
    }

    const order = orderMap.get(orderId)!;

    // Add item if product info exists
    if (props.ProductID || props.ProductName) {
      const categories = Array.isArray(props.Categories) ? props.Categories : [];
      order.items.push({
        product_id: String(props.ProductID || ''),
        product_name: String(props.ProductName || ''),
        quantity: (props.Quantity as number) || 1,
        price: (props.ItemPrice as number) || 0,
        categories,
      });
      order.categories.push(...categories);
    }
  }

  return Array.from(orderMap.values()).sort(
    (a, b) => a.order_date.getTime() - b.order_date.getTime()
  );
}

/**
 * Calculate order-based metrics
 */
function calculateOrderMetrics(
  orders: OrderSummary[],
  currentDate: Date
): {
  order_count: number;
  total_revenue: number;
  average_order_value: number;
  first_order_date?: Date;
  last_order_date?: Date;
  days_since_last_order: number;
  avg_days_between_orders: number;
} {
  if (orders.length === 0) {
    return {
      order_count: 0,
      total_revenue: 0,
      average_order_value: 0,
      first_order_date: undefined,
      last_order_date: undefined,
      days_since_last_order: Infinity,
      avg_days_between_orders: 0,
    };
  }

  const total_revenue = orders.reduce((sum, o) => sum + o.total_value, 0);
  const order_count = orders.length;
  const first_order_date = orders[0].order_date;
  const last_order_date = orders[orders.length - 1].order_date;

  const days_since_last_order = Math.floor(
    (currentDate.getTime() - last_order_date.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate average days between orders
  let avg_days_between_orders = 0;
  if (orders.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < orders.length; i++) {
      const daysBetween = Math.floor(
        (orders[i].order_date.getTime() - orders[i - 1].order_date.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      intervals.push(daysBetween);
    }
    avg_days_between_orders = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  return {
    order_count,
    total_revenue,
    average_order_value: total_revenue / order_count,
    first_order_date,
    last_order_date,
    days_since_last_order,
    avg_days_between_orders,
  };
}

/**
 * Categorize engagement events by type
 */
function categorizeEngagementEvents(events: KlaviyoEvent[]): EngagementEvent[] {
  const engagementEvents: EngagementEvent[] = [];

  for (const event of events) {
    const metricId = event.attributes.metric_id.toLowerCase();
    const props = event.attributes.event_properties;

    let eventType: EngagementEvent['event_type'] | null = null;

    if (metricId.includes('open') || metricId.includes('opened')) {
      eventType = 'email_open';
    } else if (metricId.includes('click') && metricId.includes('email')) {
      eventType = 'email_click';
    } else if (metricId.includes('bounce')) {
      eventType = 'email_bounce';
    } else if (metricId.includes('sms') && metricId.includes('click')) {
      eventType = 'sms_click';
    } else if (metricId.includes('visit') || metricId.includes('active')) {
      eventType = 'site_visit';
    } else if (metricId.includes('view') || metricId.includes('page')) {
      eventType = 'page_view';
    }

    if (eventType) {
      engagementEvents.push({
        event_id: event.id,
        profile_id: event.attributes.profile_id,
        event_type: eventType,
        timestamp: new Date(event.attributes.timestamp),
        campaign_id: String(props.CampaignId || props.campaign_id || ''),
        url: String(props.URL || props.url || ''),
        properties: props,
      });
    }
  }

  return engagementEvents;
}

/**
 * Calculate engagement metrics
 */
function calculateEngagementMetrics(
  events: EngagementEvent[],
  currentDate: Date
): {
  email_open_count: number;
  email_click_count: number;
  email_bounce_count: number;
  sms_click_count: number;
  site_visits_last_90d: number;
  last_email_open_date?: Date;
  last_email_click_date?: Date;
  last_site_visit_date?: Date;
} {
  const ninetyDaysAgo = new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000);

  const counts = {
    email_open_count: 0,
    email_click_count: 0,
    email_bounce_count: 0,
    sms_click_count: 0,
    site_visits_last_90d: 0,
    last_email_open_date: undefined as Date | undefined,
    last_email_click_date: undefined as Date | undefined,
    last_site_visit_date: undefined as Date | undefined,
  };

  for (const event of events) {
    switch (event.event_type) {
      case 'email_open':
        counts.email_open_count++;
        if (!counts.last_email_open_date || event.timestamp > counts.last_email_open_date) {
          counts.last_email_open_date = event.timestamp;
        }
        break;
      case 'email_click':
        counts.email_click_count++;
        if (!counts.last_email_click_date || event.timestamp > counts.last_email_click_date) {
          counts.last_email_click_date = event.timestamp;
        }
        break;
      case 'email_bounce':
        counts.email_bounce_count++;
        break;
      case 'sms_click':
        counts.sms_click_count++;
        break;
      case 'site_visit':
      case 'page_view':
        if (event.timestamp >= ninetyDaysAgo) {
          counts.site_visits_last_90d++;
        }
        if (!counts.last_site_visit_date || event.timestamp > counts.last_site_visit_date) {
          counts.last_site_visit_date = event.timestamp;
        }
        break;
    }
  }

  return counts;
}

/**
 * Calculate category affinity scores
 */
function calculateCategoryAffinity(orders: OrderSummary[]): {
  categories: string[];
  products: string[];
  top_category?: string;
  scores: Record<string, number>;
} {
  const categoryCount: Record<string, number> = {};
  const productSet = new Set<string>();

  for (const order of orders) {
    for (const item of order.items) {
      if (item.product_name) {
        productSet.add(item.product_name);
      }
      for (const cat of item.categories) {
        categoryCount[cat] = (categoryCount[cat] || 0) + item.quantity;
      }
    }
    for (const cat of order.categories) {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
  }

  const categories = Object.keys(categoryCount);
  const totalCount = Object.values(categoryCount).reduce((a, b) => a + b, 0);

  // Calculate affinity scores (0-1)
  const scores: Record<string, number> = {};
  for (const [cat, count] of Object.entries(categoryCount)) {
    scores[cat] = totalCount > 0 ? count / totalCount : 0;
  }

  // Find top category
  const sortedCategories = categories.sort((a, b) => categoryCount[b] - categoryCount[a]);
  const top_category = sortedCategories[0];

  return {
    categories: sortedCategories,
    products: Array.from(productSet),
    top_category,
    scores,
  };
}

/**
 * Calculate discount behavior metrics
 */
function calculateDiscountMetrics(orders: OrderSummary[]): {
  orders_with_discount: number;
  total_discount_amount: number;
  average_discount: number;
  discount_rate: number;
} {
  if (orders.length === 0) {
    return {
      orders_with_discount: 0,
      total_discount_amount: 0,
      average_discount: 0,
      discount_rate: 0,
    };
  }

  const ordersWithDiscount = orders.filter((o) => o.discount_amount > 0 || o.discount_code);
  const totalDiscount = orders.reduce((sum, o) => sum + o.discount_amount, 0);
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_value, 0);

  return {
    orders_with_discount: ordersWithDiscount.length,
    total_discount_amount: totalDiscount,
    average_discount: totalRevenue > 0 ? (totalDiscount / (totalRevenue + totalDiscount)) * 100 : 0,
    discount_rate: orders.length > 0 ? (ordersWithDiscount.length / orders.length) * 100 : 0,
  };
}

/**
 * Derive acquisition channel from UTM data
 */
function deriveAcquisitionChannel(props: Record<string, unknown>): string {
  const source = String(props.$source || props.utm_source || '').toLowerCase();
  const medium = String(props.utm_medium || '').toLowerCase();

  if (source.includes('google') || source.includes('bing')) {
    return medium.includes('cpc') || medium.includes('paid') ? 'Paid Search' : 'Organic Search';
  }
  if (source.includes('facebook') || source.includes('instagram') || source.includes('meta')) {
    return medium.includes('paid') || medium.includes('cpc') ? 'Paid Social' : 'Organic Social';
  }
  if (source.includes('email') || medium.includes('email')) {
    return 'Email';
  }
  if (source.includes('sms')) {
    return 'SMS';
  }
  if (source.includes('referral') || medium.includes('referral')) {
    return 'Referral';
  }
  if (source === 'direct' || source === '(direct)' || (!source && !medium)) {
    return 'Direct';
  }

  return 'Other';
}

/**
 * Process a batch of Klaviyo profiles
 */
export function processBatch(
  profiles: KlaviyoProfile[],
  eventsMap: Map<string, KlaviyoEvent[]>,
  currentDate: Date = new Date()
): CustomerProfile[] {
  return profiles.map((profile) => {
    const events = eventsMap.get(profile.id) || [];
    return normalizeProfile(profile, events, currentDate);
  });
}

/**
 * Flatten nested Klaviyo JSON into tabular format
 */
export function flattenToTabular(profiles: CustomerProfile[]): Record<string, unknown>[] {
  return profiles.map((profile) => ({
    // Core fields
    profile_id: profile.profile_id,
    email: profile.email,
    phone: profile.phone,
    first_name: profile.first_name,
    last_name: profile.last_name,
    full_name: profile.full_name,
    organization: profile.organization,

    // Location
    city: profile.city,
    region: profile.region,
    country: profile.country,

    // Timestamps
    created_at: profile.created_at.toISOString(),
    last_event_date: profile.last_event_date?.toISOString(),

    // Order metrics
    order_count: profile.order_count,
    total_revenue: profile.total_revenue,
    average_order_value: profile.average_order_value,
    first_order_date: profile.first_order_date?.toISOString(),
    last_order_date: profile.last_order_date?.toISOString(),
    days_since_last_order: profile.days_since_last_order,
    avg_days_between_orders: profile.avg_days_between_orders,

    // Category affinity
    top_category: profile.top_category,
    purchased_categories: profile.purchased_categories.join(','),

    // Discount behavior
    orders_with_discount: profile.orders_with_discount,
    average_discount: profile.average_discount,
    discount_rate: profile.discount_rate,

    // Engagement
    email_open_count: profile.email_open_count,
    email_click_count: profile.email_click_count,
    sms_click_count: profile.sms_click_count,
    site_visits_last_90d: profile.site_visits_last_90d,

    // Predictive
    predicted_clv: profile.predicted_clv,
    churn_risk_score: profile.churn_risk_score,

    // Acquisition
    acquisition_channel: profile.acquisition_channel,
    utm_source: profile.utm_source,
    utm_medium: profile.utm_medium,
  }));
}
