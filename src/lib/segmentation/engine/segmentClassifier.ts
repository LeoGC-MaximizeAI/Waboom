/**
 * Segment Classifier
 * Core segmentation logic implementing the 9 primary segment rules
 */

import type { CustomerProfile } from '../types/customer';
import type {
  SegmentTag,
  SegmentDefinition,
  AccountThresholds,
  CustomerSegmentResult,
  SegmentRule,
} from '../types/segments';

/**
 * All segment definitions with their rules
 */
export const SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  // 1. VIP - Top revenue AND high order frequency
  {
    tag: 'VIP',
    description: 'Top 10% revenue customers with high order frequency',
    rules: [
      {
        field: 'total_revenue',
        operator: '>=',
        value: 0, // Will use threshold
        threshold_key: 'top_10_percent_revenue_threshold',
      },
      {
        field: 'order_count',
        operator: '>=',
        value: 0, // Will use threshold + modifier
        threshold_key: 'median_order_count',
        threshold_modifier: 2, // median + 2
      },
    ],
    logical_operator: 'AND',
    priority: 1,
    is_exclusive: false,
  },

  // 2. Loyal Repeat - Consistent repeat purchasers
  {
    tag: 'Loyal Repeat',
    description: 'Customers with 3+ orders and consistent purchase intervals',
    rules: [
      {
        field: 'order_count',
        operator: '>=',
        value: 3,
      },
      {
        field: 'avg_days_between_orders',
        operator: '<=',
        value: 0, // Will use threshold + modifier
        threshold_key: 'repeat_interval_median_days',
        threshold_modifier: 10, // median + 10 days
      },
    ],
    logical_operator: 'AND',
    priority: 2,
    is_exclusive: false,
  },

  // 3. High Potential (New, High Spend) - First-time buyers with high AOV
  {
    tag: 'High Potential',
    description: 'First-time buyers with above-average order value',
    rules: [
      {
        field: 'order_count',
        operator: '==',
        value: 1,
      },
      {
        field: 'total_revenue',
        operator: '>',
        value: 0, // Will use threshold
        threshold_key: 'aov_80p',
      },
    ],
    logical_operator: 'AND',
    priority: 3,
    is_exclusive: false,
  },

  // 4. At Risk - Haven't ordered in a while but have history
  {
    tag: 'At Risk',
    description: 'Customers overdue for repeat purchase',
    rules: [
      {
        field: 'days_since_last_order',
        operator: '>=',
        value: 0, // Will use threshold + modifier
        threshold_key: 'repeat_interval_median_days',
        threshold_modifier: 30, // median + 30 days
      },
      {
        field: 'order_count',
        operator: '>=',
        value: 2,
      },
    ],
    logical_operator: 'AND',
    priority: 4,
    is_exclusive: false,
  },

  // 5. Churned - Long time since last order
  {
    tag: 'Churned',
    description: 'Customers who have likely churned (90+ days overdue)',
    rules: [
      {
        field: 'days_since_last_order',
        operator: '>=',
        value: 0, // Will use threshold + modifier
        threshold_key: 'repeat_interval_median_days',
        threshold_modifier: 90, // median + 90 days
      },
    ],
    logical_operator: 'AND',
    priority: 5,
    is_exclusive: false,
  },

  // 6. One-Time Buyers - Single purchase, now inactive
  {
    tag: 'One-Time Buyers',
    description: 'Single-purchase customers who haven\'t returned',
    rules: [
      {
        field: 'order_count',
        operator: '==',
        value: 1,
      },
      {
        field: 'days_since_last_order',
        operator: '>=',
        value: 60,
      },
    ],
    logical_operator: 'AND',
    priority: 6,
    is_exclusive: false,
  },

  // 7. Discount-Driven - High discount usage
  {
    tag: 'Discount-Driven',
    description: 'Customers who primarily buy with discounts',
    rules: [
      {
        field: 'average_discount',
        operator: '>=',
        value: 0, // Will use threshold
        threshold_key: 'discount_threshold_high',
      },
      {
        field: 'order_count',
        operator: '>=',
        value: 2,
      },
    ],
    logical_operator: 'AND',
    priority: 7,
    is_exclusive: false,
  },

  // 8. Engaged Non-Buyer - High email engagement, no purchases
  {
    tag: 'Engaged Non-Buyer',
    description: 'High engagement but hasn\'t converted',
    rules: [
      {
        field: 'email_click_count',
        operator: '>=',
        value: 3,
      },
      {
        field: 'order_count',
        operator: '==',
        value: 0,
      },
    ],
    logical_operator: 'AND',
    priority: 8,
    is_exclusive: false,
  },

  // 9. Cold Subscribers - No engagement at all
  {
    tag: 'Cold Subscribers',
    description: 'Subscribers with no recent engagement',
    rules: [
      {
        field: 'email_click_count',
        operator: '==',
        value: 0,
      },
      {
        field: 'site_visits_last_90d',
        operator: '==',
        value: 0,
      },
    ],
    logical_operator: 'AND',
    priority: 9,
    is_exclusive: false,
  },
];

/**
 * Classify a single customer into segments
 */
export function classifyCustomer(
  profile: CustomerProfile,
  thresholds: AccountThresholds
): CustomerSegmentResult {
  const matchedSegments: SegmentTag[] = [];
  const matchedRules: string[] = [];

  for (const definition of SEGMENT_DEFINITIONS) {
    const { matches, ruleDescriptions } = evaluateSegment(profile, definition, thresholds);

    if (matches) {
      matchedSegments.push(definition.tag);
      matchedRules.push(`${definition.tag}: ${ruleDescriptions.join(' AND ')}`);
    }
  }

  return {
    profile_id: profile.profile_id,
    segment_tags: matchedSegments,
    notes: {
      days_since_last_order: profile.days_since_last_order,
      avg_order_value: profile.average_order_value,
      customer_lifetime_value: profile.total_revenue,
      order_count: profile.order_count,
      total_revenue: profile.total_revenue,
      avg_days_between_orders: profile.avg_days_between_orders,
      average_discount: profile.average_discount,
      email_click_count: profile.email_click_count,
      site_visits_last_90d: profile.site_visits_last_90d,
    },
    matched_rules: matchedRules,
    segmented_at: new Date(),
  };
}

/**
 * Evaluate if a customer matches a segment definition
 */
function evaluateSegment(
  profile: CustomerProfile,
  definition: SegmentDefinition,
  thresholds: AccountThresholds
): { matches: boolean; ruleDescriptions: string[] } {
  const ruleResults: boolean[] = [];
  const ruleDescriptions: string[] = [];

  for (const rule of definition.rules) {
    const { result, description } = evaluateRule(profile, rule, thresholds);
    ruleResults.push(result);
    ruleDescriptions.push(description);
  }

  const matches =
    definition.logical_operator === 'AND'
      ? ruleResults.every((r) => r)
      : ruleResults.some((r) => r);

  return { matches, ruleDescriptions };
}

/**
 * Evaluate a single rule against a customer profile
 */
function evaluateRule(
  profile: CustomerProfile,
  rule: SegmentRule,
  thresholds: AccountThresholds
): { result: boolean; description: string } {
  // Get the actual value from the profile
  const actualValue = getProfileValue(profile, rule.field);

  // Get the threshold value (either static or dynamic)
  let thresholdValue: number;
  if (rule.threshold_key) {
    const baseThreshold = thresholds[rule.threshold_key as keyof AccountThresholds] as number;
    thresholdValue = baseThreshold + (rule.threshold_modifier || 0);
  } else {
    thresholdValue = rule.value as number;
  }

  // Evaluate the comparison
  const result = compare(actualValue, rule.operator, thresholdValue);
  const description = `${rule.field} ${rule.operator} ${thresholdValue.toFixed(2)}`;

  return { result, description };
}

/**
 * Get a value from the customer profile by field name
 */
function getProfileValue(profile: CustomerProfile, field: string): number {
  const value = profile[field as keyof CustomerProfile];

  if (typeof value === 'number') {
    return value;
  }
  if (value === undefined || value === null) {
    return 0;
  }
  if (value === Infinity) {
    return Number.MAX_SAFE_INTEGER;
  }

  return 0;
}

/**
 * Compare two values using the specified operator
 */
function compare(
  actual: number,
  operator: SegmentRule['operator'],
  threshold: number
): boolean {
  switch (operator) {
    case '>=':
      return actual >= threshold;
    case '<=':
      return actual <= threshold;
    case '>':
      return actual > threshold;
    case '<':
      return actual < threshold;
    case '==':
      return actual === threshold;
    case '!=':
      return actual !== threshold;
    default:
      return false;
  }
}

/**
 * Classify a batch of customers
 */
export function classifyBatch(
  profiles: CustomerProfile[],
  thresholds: AccountThresholds
): CustomerSegmentResult[] {
  return profiles.map((profile) => classifyCustomer(profile, thresholds));
}

/**
 * Get segment distribution from classification results
 */
export function getSegmentDistribution(
  results: CustomerSegmentResult[]
): Record<SegmentTag, number> {
  const distribution: Record<SegmentTag, number> = {
    'VIP': 0,
    'Loyal Repeat': 0,
    'High Potential': 0,
    'At Risk': 0,
    'Churned': 0,
    'One-Time Buyers': 0,
    'Discount-Driven': 0,
    'Engaged Non-Buyer': 0,
    'Cold Subscribers': 0,
  };

  for (const result of results) {
    for (const tag of result.segment_tags) {
      distribution[tag]++;
    }
  }

  return distribution;
}

/**
 * Get segment statistics
 */
export function getSegmentStats(
  results: CustomerSegmentResult[],
  profiles: CustomerProfile[]
): import('../types/segments').SegmentStats[] {
  const profileMap = new Map(profiles.map((p) => [p.profile_id, p]));

  const stats: import('../types/segments').SegmentStats[] = [];

  for (const definition of SEGMENT_DEFINITIONS) {
    const customersInSegment = results.filter((r) => r.segment_tags.includes(definition.tag));

    if (customersInSegment.length === 0) {
      stats.push({
        tag: definition.tag,
        customer_count: 0,
        percentage_of_total: 0,
        average_revenue: 0,
        average_order_count: 0,
        average_clv: 0,
        total_revenue: 0,
      });
      continue;
    }

    const segmentProfiles = customersInSegment
      .map((r) => profileMap.get(r.profile_id))
      .filter((p): p is CustomerProfile => p !== undefined);

    const totalRevenue = segmentProfiles.reduce((sum, p) => sum + p.total_revenue, 0);
    const totalOrders = segmentProfiles.reduce((sum, p) => sum + p.order_count, 0);
    const totalCLV = segmentProfiles.reduce((sum, p) => sum + (p.predicted_clv || p.total_revenue), 0);

    stats.push({
      tag: definition.tag,
      customer_count: customersInSegment.length,
      percentage_of_total: (customersInSegment.length / results.length) * 100,
      average_revenue: totalRevenue / customersInSegment.length,
      average_order_count: totalOrders / customersInSegment.length,
      average_clv: totalCLV / customersInSegment.length,
      total_revenue: totalRevenue,
    });
  }

  return stats;
}

/**
 * Filter results by segment tag
 */
export function filterBySegment(
  results: CustomerSegmentResult[],
  tag: SegmentTag
): CustomerSegmentResult[] {
  return results.filter((r) => r.segment_tags.includes(tag));
}

/**
 * Get customers with multiple segment tags (overlapping segments)
 */
export function getOverlappingSegments(
  results: CustomerSegmentResult[]
): { profile_id: string; tags: SegmentTag[]; overlap_count: number }[] {
  return results
    .filter((r) => r.segment_tags.length > 1)
    .map((r) => ({
      profile_id: r.profile_id,
      tags: r.segment_tags,
      overlap_count: r.segment_tags.length,
    }))
    .sort((a, b) => b.overlap_count - a.overlap_count);
}

/**
 * Get customers without any segment assignment
 */
export function getUnsegmentedCustomers(
  results: CustomerSegmentResult[]
): CustomerSegmentResult[] {
  return results.filter((r) => r.segment_tags.length === 0);
}
