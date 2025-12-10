/**
 * Segment Hypothesis Generator
 * Generates testable hypotheses for each segment
 */

import type { SegmentTag, SegmentHypothesis, SegmentStats } from '../types/segments';
import { v4 as uuidv4 } from './utils';

/**
 * Hypothesis templates for each segment
 * Format: If [behavior assumption] Then [creative approach] Measure [metric] over [X days]
 */
const HYPOTHESIS_TEMPLATES: Record<SegmentTag, HypothesisTemplate[]> = {
  VIP: [
    {
      hypothesis: 'VIP customers respond to exclusivity and early access',
      message_angle: 'Offer early access to new products and exclusive member-only sales',
      kpi: 'Revenue per email',
      measurement_period_days: 30,
      confidence: 'high',
      rationale: 'VIPs have demonstrated high engagement; exclusivity reinforces their valued status',
    },
    {
      hypothesis: 'VIP customers are willing to try premium/higher-priced items',
      message_angle: 'Feature premium collections and limited editions',
      kpi: 'AOV',
      measurement_period_days: 60,
      confidence: 'medium',
      rationale: 'Historical spend suggests price is less of a barrier for this segment',
    },
    {
      hypothesis: 'VIP customers can be activated as brand advocates',
      message_angle: 'Introduce referral programs with generous rewards',
      kpi: 'Referral conversion rate',
      measurement_period_days: 90,
      confidence: 'medium',
      rationale: 'High satisfaction indicated by repeat purchases makes them ideal advocates',
    },
  ],

  'Loyal Repeat': [
    {
      hypothesis: 'Loyal customers respond to subscription or auto-replenishment offers',
      message_angle: 'Promote subscription options with convenience and savings messaging',
      kpi: 'Subscription conversion rate',
      measurement_period_days: 45,
      confidence: 'high',
      rationale: 'Consistent purchase intervals suggest predictable consumption patterns',
    },
    {
      hypothesis: 'Loyal customers appreciate recognition and loyalty rewards',
      message_angle: 'Highlight loyalty points, tier status, and reward redemption',
      kpi: 'Repeat purchase rate',
      measurement_period_days: 30,
      confidence: 'high',
      rationale: 'Behavioral loyalty can be reinforced through recognition programs',
    },
    {
      hypothesis: 'Loyal customers will expand to adjacent categories',
      message_angle: 'Cross-sell related products based on purchase history',
      kpi: 'Category expansion rate',
      measurement_period_days: 60,
      confidence: 'medium',
      rationale: 'Trust is established; they are receptive to curated recommendations',
    },
  ],

  'High Potential': [
    {
      hypothesis: 'High-value first buyers need onboarding to convert to repeat',
      message_angle: 'Welcome series with product education and next-purchase incentive',
      kpi: 'Second purchase rate',
      measurement_period_days: 30,
      confidence: 'high',
      rationale: 'First 30 days are critical for establishing repeat behavior',
    },
    {
      hypothesis: 'High-value first buyers respond to personalized follow-ups',
      message_angle: 'Send personalized recommendations based on first purchase',
      kpi: 'Email click rate',
      measurement_period_days: 14,
      confidence: 'medium',
      rationale: 'Product-specific targeting increases relevance and engagement',
    },
    {
      hypothesis: 'High-value first buyers can be converted without discounts',
      message_angle: 'Focus on product value and brand story rather than price',
      kpi: 'Conversion rate without discount',
      measurement_period_days: 45,
      confidence: 'medium',
      rationale: 'Initial high spend suggests price sensitivity may be low',
    },
  ],

  'At Risk': [
    {
      hypothesis: 'At-risk customers respond to win-back offers with urgency',
      message_angle: 'Time-limited win-back offer with "we miss you" messaging',
      kpi: 'Reactivation rate',
      measurement_period_days: 14,
      confidence: 'high',
      rationale: 'Creating urgency can overcome inertia before they fully churn',
    },
    {
      hypothesis: 'At-risk customers may have unmet product needs',
      message_angle: 'Survey about preferences and showcase new products',
      kpi: 'Survey response rate and subsequent purchase',
      measurement_period_days: 30,
      confidence: 'medium',
      rationale: 'Understanding why they lapsed helps prevent future churn',
    },
    {
      hypothesis: 'At-risk customers respond to reminder of past favorites',
      message_angle: 'Personalized reminder of previously purchased items',
      kpi: 'CTR on product recommendations',
      measurement_period_days: 21,
      confidence: 'medium',
      rationale: 'Nostalgia and familiarity can trigger re-engagement',
    },
  ],

  Churned: [
    {
      hypothesis: 'Churned customers require significant incentive to return',
      message_angle: 'Aggressive win-back with substantial discount or gift',
      kpi: 'Reactivation rate',
      measurement_period_days: 30,
      confidence: 'medium',
      rationale: 'Longer absence requires stronger incentive to overcome switching costs',
    },
    {
      hypothesis: 'Churned customers may respond to brand evolution messaging',
      message_angle: 'Highlight what\'s new since they last shopped',
      kpi: 'Site visit rate',
      measurement_period_days: 21,
      confidence: 'low',
      rationale: 'Product updates may address previous dissatisfaction',
    },
    {
      hypothesis: 'Churned customers should be evaluated for suppression',
      message_angle: 'Reduced email frequency with only high-impact campaigns',
      kpi: 'Unsubscribe rate',
      measurement_period_days: 60,
      confidence: 'high',
      rationale: 'Protecting deliverability by not over-mailing unengaged users',
    },
  ],

  'One-Time Buyers': [
    {
      hypothesis: 'One-time buyers need a second-purchase nudge within 60 days',
      message_angle: 'Time-sensitive second-order incentive with countdown',
      kpi: 'Second purchase rate',
      measurement_period_days: 30,
      confidence: 'high',
      rationale: 'Breaking the single-purchase pattern early is critical',
    },
    {
      hypothesis: 'One-time buyers respond to social proof and reviews',
      message_angle: 'Share customer reviews and UGC for confidence building',
      kpi: 'CTR on review content',
      measurement_period_days: 21,
      confidence: 'medium',
      rationale: 'Building trust through social validation can overcome hesitation',
    },
    {
      hypothesis: 'One-time buyers may have bought a gift, not for themselves',
      message_angle: 'Position products as "treat yourself" with self-purchase angle',
      kpi: 'Conversion rate on self-purchase messaging',
      measurement_period_days: 45,
      confidence: 'low',
      rationale: 'Gift buyers represent different conversion opportunity',
    },
  ],

  'Discount-Driven': [
    {
      hypothesis: 'Discount-driven customers will only convert with promotions',
      message_angle: 'Focus campaigns during sale events, reduce full-price sends',
      kpi: 'Revenue per promotional email',
      measurement_period_days: 30,
      confidence: 'high',
      rationale: 'Align messaging with demonstrated purchase behavior',
    },
    {
      hypothesis: 'Discount-driven customers can be shifted to value messaging',
      message_angle: 'Emphasize product value, quality, and durability over price',
      kpi: 'Conversion rate on value-focused content',
      measurement_period_days: 60,
      confidence: 'low',
      rationale: 'Testing if perception can be shifted from discount to value',
    },
    {
      hypothesis: 'Discount-driven customers respond to threshold incentives',
      message_angle: 'Offer tiered discounts (spend more, save more)',
      kpi: 'AOV lift',
      measurement_period_days: 30,
      confidence: 'medium',
      rationale: 'Can increase order value while still offering perceived savings',
    },
  ],

  'Engaged Non-Buyer': [
    {
      hypothesis: 'Engaged non-buyers have a specific conversion barrier',
      message_angle: 'First-purchase incentive with strong CTA',
      kpi: 'First purchase conversion rate',
      measurement_period_days: 21,
      confidence: 'high',
      rationale: 'High engagement without purchase suggests barrier to overcome',
    },
    {
      hypothesis: 'Engaged non-buyers need social proof to convert',
      message_angle: 'Feature reviews, ratings, and customer testimonials prominently',
      kpi: 'Conversion rate on social proof emails',
      measurement_period_days: 30,
      confidence: 'medium',
      rationale: 'Trust deficit may be the primary barrier',
    },
    {
      hypothesis: 'Engaged non-buyers may be browsing for gifting occasions',
      message_angle: 'Gift guide and gifting-focused messaging',
      kpi: 'Conversion rate on gift messaging',
      measurement_period_days: 45,
      confidence: 'low',
      rationale: 'Browsing without buying may indicate research for others',
    },
  ],

  'Cold Subscribers': [
    {
      hypothesis: 'Cold subscribers may need re-permission or list cleaning',
      message_angle: 'Re-engagement campaign asking to confirm interest',
      kpi: 'Re-engagement rate',
      measurement_period_days: 14,
      confidence: 'high',
      rationale: 'Protect deliverability by cleaning unengaged subscribers',
    },
    {
      hypothesis: 'Cold subscribers may respond to channel shift',
      message_angle: 'Offer SMS opt-in as alternative communication channel',
      kpi: 'SMS opt-in rate',
      measurement_period_days: 21,
      confidence: 'medium',
      rationale: 'Some users prefer different channels',
    },
    {
      hypothesis: 'Cold subscribers should be suppressed from regular sends',
      message_angle: 'Suppress from campaigns, only send win-back series',
      kpi: 'Deliverability metrics',
      measurement_period_days: 30,
      confidence: 'high',
      rationale: 'Continued mailing hurts sender reputation',
    },
  ],
};

interface HypothesisTemplate {
  hypothesis: string;
  message_angle: string;
  kpi: string;
  measurement_period_days: number;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
}

/**
 * Generate hypotheses for a specific segment
 */
export function generateHypothesesForSegment(
  tag: SegmentTag,
  stats?: SegmentStats
): SegmentHypothesis[] {
  const templates = HYPOTHESIS_TEMPLATES[tag];

  return templates.map((template) => ({
    hypothesis_id: uuidv4(),
    segment_tag: tag,
    hypothesis: template.hypothesis,
    message_angle: template.message_angle,
    kpi: template.kpi,
    measurement_period_days: template.measurement_period_days,
    confidence: template.confidence,
    rationale: template.rationale,
  }));
}

/**
 * Generate hypotheses for all segments
 */
export function generateAllHypotheses(
  segmentStats?: SegmentStats[]
): SegmentHypothesis[] {
  const allHypotheses: SegmentHypothesis[] = [];
  const statsMap = new Map(segmentStats?.map((s) => [s.tag, s]));

  for (const tag of Object.keys(HYPOTHESIS_TEMPLATES) as SegmentTag[]) {
    const stats = statsMap.get(tag);
    const hypotheses = generateHypothesesForSegment(tag, stats);
    allHypotheses.push(...hypotheses);
  }

  return allHypotheses;
}

/**
 * Format hypotheses as a structured table
 */
export function formatHypothesesTable(
  hypotheses: SegmentHypothesis[]
): string {
  const headers = ['Segment', 'Hypothesis', 'Message Angle', 'KPI', 'Days', 'Confidence'];
  const rows = hypotheses.map((h) => [
    h.segment_tag,
    h.hypothesis,
    h.message_angle,
    h.kpi,
    h.measurement_period_days.toString(),
    h.confidence,
  ]);

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );

  // Format header
  const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');

  // Format data rows
  const dataRows = rows.map((row) =>
    row.map((cell, i) => cell.padEnd(widths[i])).join(' | ')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}

/**
 * Get high-confidence hypotheses only
 */
export function getHighConfidenceHypotheses(
  hypotheses: SegmentHypothesis[]
): SegmentHypothesis[] {
  return hypotheses.filter((h) => h.confidence === 'high');
}

/**
 * Group hypotheses by KPI type
 */
export function groupHypothesesByKPI(
  hypotheses: SegmentHypothesis[]
): Record<string, SegmentHypothesis[]> {
  const groups: Record<string, SegmentHypothesis[]> = {};

  for (const hypothesis of hypotheses) {
    const kpi = hypothesis.kpi;
    if (!groups[kpi]) {
      groups[kpi] = [];
    }
    groups[kpi].push(hypothesis);
  }

  return groups;
}

/**
 * Generate hypothesis for a micro-segment
 */
export function generateMicroSegmentHypothesis(
  parentTag: SegmentTag,
  microSegmentName: string,
  microSegmentId: string,
  customHypothesis: string,
  customAngle: string,
  kpi: string,
  days: number = 30
): SegmentHypothesis {
  return {
    hypothesis_id: uuidv4(),
    segment_tag: parentTag,
    micro_segment_id: microSegmentId,
    hypothesis: customHypothesis,
    message_angle: customAngle,
    kpi,
    measurement_period_days: days,
    confidence: 'medium',
    rationale: `Custom hypothesis for micro-segment: ${microSegmentName}`,
  };
}
