/**
 * Segment Types and Definitions
 * Customer segmentation logic structures
 */

// Primary segment tags
export type SegmentTag =
  | 'VIP'
  | 'Loyal Repeat'
  | 'High Potential'
  | 'At Risk'
  | 'Churned'
  | 'One-Time Buyers'
  | 'Discount-Driven'
  | 'Engaged Non-Buyer'
  | 'Cold Subscribers';

// Segment rule operator types
export type ComparisonOperator = '>=' | '<=' | '>' | '<' | '==' | '!=';
export type LogicalOperator = 'AND' | 'OR';

// Individual segment rule
export interface SegmentRule {
  field: string;
  operator: ComparisonOperator;
  value: number | string | boolean;
  // For dynamic thresholds that reference account metrics
  threshold_key?: string;
  threshold_modifier?: number; // e.g., +10, +30, +90 for days
}

// Complete segment definition
export interface SegmentDefinition {
  tag: SegmentTag;
  description: string;
  rules: SegmentRule[];
  logical_operator: LogicalOperator;
  priority: number; // Lower = higher priority for conflict resolution
  is_exclusive: boolean; // If true, customer can't have other exclusive tags
}

// Account-wide thresholds (computed from data)
export interface AccountThresholds {
  // Revenue percentiles
  top_10_percent_revenue_threshold: number;
  top_20_percent_revenue_threshold: number;
  top_50_percent_revenue_threshold: number;

  // Order metrics
  median_order_count: number;
  mean_order_count: number;

  // AOV percentiles
  aov_50p: number;
  aov_80p: number;
  aov_90p: number;

  // Time-based metrics
  repeat_interval_median_days: number;
  repeat_interval_mean_days: number;

  // Discount metrics
  discount_threshold_high: number; // e.g., 20%
  discount_threshold_medium: number; // e.g., 10%
  average_discount_rate: number;

  // Engagement thresholds
  email_click_threshold_high: number;
  email_open_threshold_high: number;

  // Computed at runtime
  computed_at: Date;
  profile_count: number;
  active_customer_count: number;
}

// Result of segmenting a single customer
export interface CustomerSegmentResult {
  profile_id: string;
  segment_tags: SegmentTag[];
  notes: {
    days_since_last_order: number;
    avg_order_value: number;
    customer_lifetime_value: number;
    order_count: number;
    total_revenue: number;
    avg_days_between_orders?: number;
    average_discount?: number;
    email_click_count?: number;
    site_visits_last_90d?: number;
  };
  matched_rules: string[]; // Which rules triggered each segment
  segmented_at: Date;
}

// Segment statistics
export interface SegmentStats {
  tag: SegmentTag;
  customer_count: number;
  percentage_of_total: number;
  average_revenue: number;
  average_order_count: number;
  average_clv: number;
  total_revenue: number;
}

// Micro-segment definition
export interface MicroSegment {
  micro_segment_id: string;
  parent_segment: SegmentTag;
  name: string;
  description: string;
  rules: MicroSegmentRule[];
  estimated_size: number;
  percentage_of_parent: number;
  creative_viable: boolean;
  viability_reason?: string;
}

export interface MicroSegmentRule {
  dimension: 'discount_behavior' | 'category_affinity' | 'geography' | 'engagement' | 'recency' | 'value_tier';
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean | string[];
}

// Segment hypothesis
export interface SegmentHypothesis {
  hypothesis_id: string;
  segment_tag: SegmentTag;
  micro_segment_id?: string;
  hypothesis: string; // "If [behavior assumption]"
  message_angle: string; // "Then [creative approach]"
  kpi: string; // "Measure [metric]"
  measurement_period_days: number;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
}

// Full segment output
export interface SegmentOutput {
  segment_id: string;
  segment_tag: SegmentTag;
  definition: SegmentDefinition;
  stats: SegmentStats;
  micro_segments: MicroSegment[];
  hypotheses: SegmentHypothesis[];
  customers: CustomerSegmentResult[];
}

// Batch segmentation result
export interface SegmentationResult {
  run_id: string;
  run_at: Date;
  thresholds: AccountThresholds;
  total_profiles_processed: number;
  segment_outputs: SegmentOutput[];
  segment_distribution: Record<SegmentTag, number>;
  processing_time_ms: number;
}
