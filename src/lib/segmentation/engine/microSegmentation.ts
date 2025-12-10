/**
 * Micro-Segmentation Engine
 * Creates granular sub-segments within parent segments
 */

import type { CustomerProfile } from '../types/customer';
import type {
  SegmentTag,
  MicroSegment,
  MicroSegmentRule,
  CustomerSegmentResult,
  AccountThresholds,
} from '../types/segments';
import { v4 as uuidv4, slugify } from './utils';

/**
 * Micro-segment templates for each parent segment
 */
const MICRO_SEGMENT_TEMPLATES: Record<SegmentTag, MicroSegmentTemplate[]> = {
  VIP: [
    {
      name: 'VIP Premium Category Lovers',
      description: 'VIP customers with strong affinity for premium/luxury categories',
      dimension: 'category_affinity',
      rules: [
        { dimension: 'category_affinity', field: 'top_category', operator: '==', value: ['premium', 'luxury', 'designer'] },
      ],
      creative_viable: true,
    },
    {
      name: 'VIP High Frequency',
      description: 'VIP customers who order more than once per month',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'avg_days_between_orders', operator: '<=', value: 30 },
      ],
      creative_viable: true,
    },
    {
      name: 'VIP Multi-Category',
      description: 'VIP customers who buy across multiple categories',
      dimension: 'category_affinity',
      rules: [
        { dimension: 'category_affinity', field: 'purchased_categories_count', operator: '>=', value: 3 },
      ],
      creative_viable: true,
    },
    {
      name: 'VIP Regional',
      description: 'VIP customers in specific high-value regions',
      dimension: 'geography',
      rules: [
        { dimension: 'geography', field: 'country', operator: '==', value: ['US', 'UK', 'AU', 'CA'] },
      ],
      creative_viable: true,
    },
    {
      name: 'VIP Full-Price Buyers',
      description: 'VIP customers who rarely use discounts',
      dimension: 'discount_behavior',
      rules: [
        { dimension: 'discount_behavior', field: 'discount_rate', operator: '<', value: 10 },
      ],
      creative_viable: true,
    },
  ],

  'Loyal Repeat': [
    {
      name: 'Loyal Same-Category Buyers',
      description: 'Loyal customers who consistently buy from one category',
      dimension: 'category_affinity',
      rules: [
        { dimension: 'category_affinity', field: 'purchased_categories_count', operator: '==', value: 1 },
      ],
      creative_viable: true,
    },
    {
      name: 'Loyal Clockwork Buyers',
      description: 'Loyal customers with very predictable purchase intervals',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'purchase_interval_consistency', operator: '>=', value: 0.8 },
      ],
      creative_viable: true,
    },
    {
      name: 'Loyal Discount Seekers',
      description: 'Loyal customers who frequently use promotions',
      dimension: 'discount_behavior',
      rules: [
        { dimension: 'discount_behavior', field: 'discount_rate', operator: '>=', value: 50 },
      ],
      creative_viable: true,
    },
    {
      name: 'Loyal Email Engaged',
      description: 'Loyal customers with high email engagement',
      dimension: 'engagement',
      rules: [
        { dimension: 'engagement', field: 'email_click_count', operator: '>=', value: 10 },
      ],
      creative_viable: true,
    },
  ],

  'High Potential': [
    {
      name: 'High Potential Premium First Buy',
      description: 'First buyers who purchased premium items',
      dimension: 'value_tier',
      rules: [
        { dimension: 'value_tier', field: 'average_order_value', operator: '>=', value: 'aov_90p' },
      ],
      creative_viable: true,
    },
    {
      name: 'High Potential Recent',
      description: 'High-value first buyers in the last 30 days',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'days_since_last_order', operator: '<=', value: 30 },
      ],
      creative_viable: true,
    },
    {
      name: 'High Potential Gift Givers',
      description: 'High-value first buyers (possible gift purchases)',
      dimension: 'category_affinity',
      rules: [
        { dimension: 'category_affinity', field: 'top_category', operator: '==', value: ['gifts', 'bundles', 'sets'] },
      ],
      creative_viable: true,
    },
    {
      name: 'High Potential Engaged',
      description: 'High-value first buyers with email engagement',
      dimension: 'engagement',
      rules: [
        { dimension: 'engagement', field: 'email_click_count', operator: '>=', value: 1 },
      ],
      creative_viable: true,
    },
  ],

  'At Risk': [
    {
      name: 'At Risk Recently Lapsed',
      description: 'At-risk customers who lapsed 30-45 days ago',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'days_since_last_order', operator: '<=', value: 45 },
      ],
      creative_viable: true,
    },
    {
      name: 'At Risk High Value',
      description: 'At-risk customers with high historical value',
      dimension: 'value_tier',
      rules: [
        { dimension: 'value_tier', field: 'total_revenue', operator: '>=', value: 'top_20_percent_revenue_threshold' },
      ],
      creative_viable: true,
    },
    {
      name: 'At Risk Discount Responders',
      description: 'At-risk customers who historically respond to discounts',
      dimension: 'discount_behavior',
      rules: [
        { dimension: 'discount_behavior', field: 'discount_rate', operator: '>=', value: 40 },
      ],
      creative_viable: true,
    },
    {
      name: 'At Risk Still Engaged',
      description: 'At-risk customers still opening emails',
      dimension: 'engagement',
      rules: [
        { dimension: 'engagement', field: 'email_open_count', operator: '>=', value: 3 },
      ],
      creative_viable: true,
    },
  ],

  Churned: [
    {
      name: 'Churned Former VIP',
      description: 'Churned customers who were previously high-value',
      dimension: 'value_tier',
      rules: [
        { dimension: 'value_tier', field: 'total_revenue', operator: '>=', value: 'top_20_percent_revenue_threshold' },
      ],
      creative_viable: true,
    },
    {
      name: 'Churned Single Purchase',
      description: 'Churned customers with only one order',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'order_count', operator: '==', value: 1 },
      ],
      creative_viable: false,
      viability_reason: 'Low expected return on creative investment',
    },
    {
      name: 'Churned Recently',
      description: 'Churned customers who became inactive 90-120 days ago',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'days_since_last_order', operator: '<=', value: 120 },
      ],
      creative_viable: true,
    },
  ],

  'One-Time Buyers': [
    {
      name: 'One-Time High AOV',
      description: 'Single purchasers with above-average order value',
      dimension: 'value_tier',
      rules: [
        { dimension: 'value_tier', field: 'average_order_value', operator: '>=', value: 'aov_80p' },
      ],
      creative_viable: true,
    },
    {
      name: 'One-Time Recent',
      description: 'Single purchasers in the last 60-90 days',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'days_since_last_order', operator: '<=', value: 90 },
      ],
      creative_viable: true,
    },
    {
      name: 'One-Time Category Specific',
      description: 'Single purchasers from specific high-repeat categories',
      dimension: 'category_affinity',
      rules: [
        { dimension: 'category_affinity', field: 'top_category', operator: '==', value: ['consumables', 'skincare', 'food'] },
      ],
      creative_viable: true,
    },
    {
      name: 'One-Time Engaged',
      description: 'Single purchasers still engaging with emails',
      dimension: 'engagement',
      rules: [
        { dimension: 'engagement', field: 'email_click_count', operator: '>=', value: 2 },
      ],
      creative_viable: true,
    },
  ],

  'Discount-Driven': [
    {
      name: 'Discount Heavy Users',
      description: 'Customers using discounts on 80%+ of orders',
      dimension: 'discount_behavior',
      rules: [
        { dimension: 'discount_behavior', field: 'discount_rate', operator: '>=', value: 80 },
      ],
      creative_viable: true,
    },
    {
      name: 'Discount High Value',
      description: 'Discount users with high overall spend',
      dimension: 'value_tier',
      rules: [
        { dimension: 'value_tier', field: 'total_revenue', operator: '>=', value: 'top_50_percent_revenue_threshold' },
      ],
      creative_viable: true,
    },
    {
      name: 'Discount Low Frequency',
      description: 'Discount users who order infrequently',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'avg_days_between_orders', operator: '>=', value: 60 },
      ],
      creative_viable: true,
    },
  ],

  'Engaged Non-Buyer': [
    {
      name: 'Engaged Non-Buyer Heavy Clickers',
      description: 'Non-buyers with 10+ email clicks',
      dimension: 'engagement',
      rules: [
        { dimension: 'engagement', field: 'email_click_count', operator: '>=', value: 10 },
      ],
      creative_viable: true,
    },
    {
      name: 'Engaged Non-Buyer Site Browsers',
      description: 'Non-buyers with recent site visits',
      dimension: 'engagement',
      rules: [
        { dimension: 'engagement', field: 'site_visits_last_90d', operator: '>=', value: 3 },
      ],
      creative_viable: true,
    },
    {
      name: 'Engaged Non-Buyer New Subscribers',
      description: 'Non-buyers subscribed in the last 30 days',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'days_since_signup', operator: '<=', value: 30 },
      ],
      creative_viable: true,
    },
  ],

  'Cold Subscribers': [
    {
      name: 'Cold Long-Term',
      description: 'Cold subscribers subscribed 90+ days ago',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'days_since_signup', operator: '>=', value: 90 },
      ],
      creative_viable: false,
      viability_reason: 'Should be suppressed or cleaned from list',
    },
    {
      name: 'Cold Recent Signup',
      description: 'Cold subscribers who signed up recently',
      dimension: 'recency',
      rules: [
        { dimension: 'recency', field: 'days_since_signup', operator: '<=', value: 30 },
      ],
      creative_viable: true,
    },
    {
      name: 'Cold With Orders',
      description: 'Cold subscribers who have past orders',
      dimension: 'value_tier',
      rules: [
        { dimension: 'value_tier', field: 'order_count', operator: '>=', value: 1 },
      ],
      creative_viable: true,
    },
  ],
};

interface MicroSegmentTemplate {
  name: string;
  description: string;
  dimension: MicroSegmentRule['dimension'];
  rules: MicroSegmentRule[];
  creative_viable: boolean;
  viability_reason?: string;
}

/**
 * Generate micro-segments for a parent segment
 */
export function generateMicroSegments(
  parentTag: SegmentTag,
  customersInSegment: CustomerProfile[],
  thresholds: AccountThresholds
): MicroSegment[] {
  const templates = MICRO_SEGMENT_TEMPLATES[parentTag];
  const parentSize = customersInSegment.length;

  if (parentSize === 0) {
    return [];
  }

  const microSegments: MicroSegment[] = [];

  for (const template of templates) {
    // Resolve threshold references in rules
    const resolvedRules = resolveRules(template.rules, thresholds);

    // Count customers matching this micro-segment
    const matchingCustomers = customersInSegment.filter((customer) =>
      evaluateMicroSegmentRules(customer, resolvedRules, thresholds)
    );

    const estimatedSize = matchingCustomers.length;
    const percentageOfParent = (estimatedSize / parentSize) * 100;

    microSegments.push({
      micro_segment_id: `ms_${slugify(template.name)}_${uuidv4().slice(0, 8)}`,
      parent_segment: parentTag,
      name: template.name,
      description: template.description,
      rules: resolvedRules,
      estimated_size: estimatedSize,
      percentage_of_parent: percentageOfParent,
      creative_viable: template.creative_viable && estimatedSize >= 100, // Minimum size for creative viability
      viability_reason: estimatedSize < 100
        ? 'Segment size too small for dedicated creative'
        : template.viability_reason,
    });
  }

  // Sort by size descending
  microSegments.sort((a, b) => b.estimated_size - a.estimated_size);

  return microSegments;
}

/**
 * Resolve threshold references in rules
 */
function resolveRules(
  rules: MicroSegmentRule[],
  thresholds: AccountThresholds
): MicroSegmentRule[] {
  return rules.map((rule) => {
    if (typeof rule.value === 'string' && rule.value in thresholds) {
      return {
        ...rule,
        value: thresholds[rule.value as keyof AccountThresholds] as number,
      };
    }
    return rule;
  });
}

/**
 * Evaluate micro-segment rules against a customer
 */
function evaluateMicroSegmentRules(
  customer: CustomerProfile,
  rules: MicroSegmentRule[],
  thresholds: AccountThresholds
): boolean {
  for (const rule of rules) {
    if (!evaluateSingleMicroRule(customer, rule, thresholds)) {
      return false;
    }
  }
  return true;
}

/**
 * Evaluate a single micro-segment rule
 */
function evaluateSingleMicroRule(
  customer: CustomerProfile,
  rule: MicroSegmentRule,
  thresholds: AccountThresholds
): boolean {
  // Get the customer value for this field
  let customerValue: unknown;

  // Handle special computed fields
  switch (rule.field) {
    case 'purchased_categories_count':
      customerValue = customer.purchased_categories.length;
      break;
    case 'purchase_interval_consistency':
      // Calculate consistency as inverse of coefficient of variation
      customerValue = 0.5; // Placeholder - would need order history for accurate calculation
      break;
    case 'days_since_signup':
      customerValue = Math.floor(
        (Date.now() - customer.created_at.getTime()) / (1000 * 60 * 60 * 24)
      );
      break;
    default:
      customerValue = customer[rule.field as keyof CustomerProfile];
  }

  // Get the threshold value
  let thresholdValue = rule.value;
  if (typeof thresholdValue === 'string' && thresholdValue in thresholds) {
    thresholdValue = thresholds[thresholdValue as keyof AccountThresholds] as number;
  }

  // Handle array comparisons (for category matching)
  if (Array.isArray(thresholdValue)) {
    if (rule.operator === '==') {
      return thresholdValue.some((v) =>
        String(customerValue).toLowerCase().includes(String(v).toLowerCase())
      );
    }
    return false;
  }

  // Numeric comparisons
  const numValue = typeof customerValue === 'number' ? customerValue : parseFloat(String(customerValue)) || 0;
  const numThreshold = typeof thresholdValue === 'number' ? thresholdValue : parseFloat(String(thresholdValue)) || 0;

  switch (rule.operator) {
    case '>=':
      return numValue >= numThreshold;
    case '<=':
      return numValue <= numThreshold;
    case '>':
      return numValue > numThreshold;
    case '<':
      return numValue < numThreshold;
    case '==':
      return numValue === numThreshold || String(customerValue) === String(thresholdValue);
    case '!=':
      return numValue !== numThreshold && String(customerValue) !== String(thresholdValue);
    default:
      return false;
  }
}

/**
 * Generate all micro-segments for all parent segments
 */
export function generateAllMicroSegments(
  segmentResults: CustomerSegmentResult[],
  profiles: CustomerProfile[],
  thresholds: AccountThresholds
): Map<SegmentTag, MicroSegment[]> {
  const profileMap = new Map(profiles.map((p) => [p.profile_id, p]));
  const microSegmentMap = new Map<SegmentTag, MicroSegment[]>();

  for (const parentTag of Object.keys(MICRO_SEGMENT_TEMPLATES) as SegmentTag[]) {
    // Get customers in this parent segment
    const customerIds = segmentResults
      .filter((r) => r.segment_tags.includes(parentTag))
      .map((r) => r.profile_id);

    const customersInSegment = customerIds
      .map((id) => profileMap.get(id))
      .filter((p): p is CustomerProfile => p !== undefined);

    const microSegments = generateMicroSegments(parentTag, customersInSegment, thresholds);
    microSegmentMap.set(parentTag, microSegments);
  }

  return microSegmentMap;
}

/**
 * Get viable micro-segments only
 */
export function getViableMicroSegments(
  microSegments: MicroSegment[]
): MicroSegment[] {
  return microSegments.filter((ms) => ms.creative_viable);
}

/**
 * Format micro-segments as table
 */
export function formatMicroSegmentsTable(
  microSegments: MicroSegment[]
): string {
  const headers = ['Parent', 'Micro-Segment', 'Size', '% of Parent', 'Viable', 'Reason'];
  const rows = microSegments.map((ms) => [
    ms.parent_segment,
    ms.name,
    ms.estimated_size.toString(),
    `${ms.percentage_of_parent.toFixed(1)}%`,
    ms.creative_viable ? 'Yes' : 'No',
    ms.viability_reason || '-',
  ]);

  const widths = headers.map((h, i) =>
    Math.min(40, Math.max(h.length, ...rows.map((r) => r[i].length)))
  );

  const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
  const dataRows = rows.map((row) =>
    row.map((cell, i) => cell.slice(0, widths[i]).padEnd(widths[i])).join(' | ')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}

/**
 * Get customers in a specific micro-segment
 */
export function getCustomersInMicroSegment(
  microSegment: MicroSegment,
  profiles: CustomerProfile[],
  thresholds: AccountThresholds
): CustomerProfile[] {
  return profiles.filter((customer) =>
    evaluateMicroSegmentRules(customer, microSegment.rules, thresholds)
  );
}
