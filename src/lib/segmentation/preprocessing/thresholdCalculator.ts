/**
 * Threshold Calculator
 * Computes account-wide thresholds from customer data
 */

import type { CustomerProfile } from '../types/customer';
import type { AccountThresholds } from '../types/segments';

/**
 * Calculate account-wide thresholds from a batch of customer profiles
 */
export function calculateThresholds(
  profiles: CustomerProfile[],
  config: ThresholdConfig = {}
): AccountThresholds {
  const now = new Date();

  // Filter to customers with at least one order for revenue calculations
  const customersWithOrders = profiles.filter((p) => p.order_count > 0);

  // All revenue values (sorted for percentile calculations)
  const revenues = customersWithOrders
    .map((p) => p.total_revenue)
    .sort((a, b) => a - b);

  // All order counts
  const orderCounts = customersWithOrders.map((p) => p.order_count);

  // All AOVs (from customers with orders)
  const aovs = customersWithOrders
    .filter((p) => p.average_order_value > 0)
    .map((p) => p.average_order_value)
    .sort((a, b) => a - b);

  // Days between orders (from repeat customers only)
  const repeatCustomers = customersWithOrders.filter((p) => p.order_count >= 2);
  const repeatIntervals = repeatCustomers
    .filter((p) => p.avg_days_between_orders > 0)
    .map((p) => p.avg_days_between_orders)
    .sort((a, b) => a - b);

  // Discount rates (from customers with orders)
  const discountRates = customersWithOrders
    .map((p) => p.average_discount)
    .sort((a, b) => a - b);

  // Email click counts (all profiles)
  const emailClicks = profiles.map((p) => p.email_click_count).sort((a, b) => a - b);

  // Email open counts
  const emailOpens = profiles.map((p) => p.email_open_count).sort((a, b) => a - b);

  return {
    // Revenue percentiles
    top_10_percent_revenue_threshold: percentile(revenues, 90),
    top_20_percent_revenue_threshold: percentile(revenues, 80),
    top_50_percent_revenue_threshold: percentile(revenues, 50),

    // Order metrics
    median_order_count: median(orderCounts),
    mean_order_count: mean(orderCounts),

    // AOV percentiles
    aov_50p: percentile(aovs, 50),
    aov_80p: percentile(aovs, 80),
    aov_90p: percentile(aovs, 90),

    // Repeat interval (days between orders)
    repeat_interval_median_days:
      repeatIntervals.length > 0
        ? median(repeatIntervals)
        : config.default_repeat_interval_days || 30,
    repeat_interval_mean_days:
      repeatIntervals.length > 0
        ? mean(repeatIntervals)
        : config.default_repeat_interval_days || 30,

    // Discount thresholds
    discount_threshold_high: config.discount_threshold_high || 20, // 20% discount
    discount_threshold_medium: config.discount_threshold_medium || 10, // 10% discount
    average_discount_rate: mean(discountRates),

    // Engagement thresholds (using 75th percentile as "high")
    email_click_threshold_high: Math.max(percentile(emailClicks, 75), config.min_click_threshold || 3),
    email_open_threshold_high: Math.max(percentile(emailOpens, 75), config.min_open_threshold || 5),

    // Metadata
    computed_at: now,
    profile_count: profiles.length,
    active_customer_count: customersWithOrders.length,
  };
}

/**
 * Configuration options for threshold calculation
 */
export interface ThresholdConfig {
  // Fallback values if no repeat customers exist
  default_repeat_interval_days?: number;

  // Discount thresholds (percentage)
  discount_threshold_high?: number;
  discount_threshold_medium?: number;

  // Minimum engagement thresholds
  min_click_threshold?: number;
  min_open_threshold?: number;
}

/**
 * Calculate percentile value from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedValues.length) {
    return sortedValues[sortedValues.length - 1];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Calculate median value
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate mean value
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Get summary statistics for a metric
 */
export function getSummaryStats(values: number[]): {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std_dev: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
} {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      std_dev: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: mean(values),
    median: median(values),
    std_dev: standardDeviation(values),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

/**
 * Calculate distribution buckets for visualization
 */
export function getDistributionBuckets(
  values: number[],
  bucketCount: number = 10
): { min: number; max: number; count: number; percentage: number }[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const bucketSize = (max - min) / bucketCount;

  const buckets: { min: number; max: number; count: number; percentage: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = i === bucketCount - 1 ? max + 1 : min + (i + 1) * bucketSize;

    const count = sorted.filter((v) => v >= bucketMin && v < bucketMax).length;

    buckets.push({
      min: bucketMin,
      max: bucketMax,
      count,
      percentage: (count / values.length) * 100,
    });
  }

  return buckets;
}

/**
 * Incrementally update thresholds with new data (for streaming/batch processing)
 */
export function mergeThresholds(
  existing: AccountThresholds,
  newData: AccountThresholds,
  existingWeight: number = 0.7
): AccountThresholds {
  const newWeight = 1 - existingWeight;

  return {
    top_10_percent_revenue_threshold:
      existing.top_10_percent_revenue_threshold * existingWeight +
      newData.top_10_percent_revenue_threshold * newWeight,
    top_20_percent_revenue_threshold:
      existing.top_20_percent_revenue_threshold * existingWeight +
      newData.top_20_percent_revenue_threshold * newWeight,
    top_50_percent_revenue_threshold:
      existing.top_50_percent_revenue_threshold * existingWeight +
      newData.top_50_percent_revenue_threshold * newWeight,

    median_order_count:
      existing.median_order_count * existingWeight + newData.median_order_count * newWeight,
    mean_order_count:
      existing.mean_order_count * existingWeight + newData.mean_order_count * newWeight,

    aov_50p: existing.aov_50p * existingWeight + newData.aov_50p * newWeight,
    aov_80p: existing.aov_80p * existingWeight + newData.aov_80p * newWeight,
    aov_90p: existing.aov_90p * existingWeight + newData.aov_90p * newWeight,

    repeat_interval_median_days:
      existing.repeat_interval_median_days * existingWeight +
      newData.repeat_interval_median_days * newWeight,
    repeat_interval_mean_days:
      existing.repeat_interval_mean_days * existingWeight +
      newData.repeat_interval_mean_days * newWeight,

    discount_threshold_high: newData.discount_threshold_high,
    discount_threshold_medium: newData.discount_threshold_medium,
    average_discount_rate:
      existing.average_discount_rate * existingWeight +
      newData.average_discount_rate * newWeight,

    email_click_threshold_high:
      existing.email_click_threshold_high * existingWeight +
      newData.email_click_threshold_high * newWeight,
    email_open_threshold_high:
      existing.email_open_threshold_high * existingWeight +
      newData.email_open_threshold_high * newWeight,

    computed_at: newData.computed_at,
    profile_count: existing.profile_count + newData.profile_count,
    active_customer_count: existing.active_customer_count + newData.active_customer_count,
  };
}
