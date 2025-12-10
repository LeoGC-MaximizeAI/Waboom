/**
 * Output Formatter
 * Structures final outputs for ops/activation workflows
 */

import type { SegmentTag, CustomerSegmentResult, SegmentStats, MicroSegment, SegmentHypothesis } from '../types/segments';
import type { CreativeBrief, ImageGenerationPrompt, OpsOutputRow, PipelineOutput, ComplianceCheckResult } from '../types/creative';
import { v4 as uuidv4, slugify } from '../engine/utils';

/**
 * Generate ops-ready output rows from pipeline results
 */
export function generateOpsRows(
  briefs: CreativeBrief[],
  prompts: ImageGenerationPrompt[],
  segmentStats: SegmentStats[],
  hypotheses: SegmentHypothesis[]
): OpsOutputRow[] {
  const rows: OpsOutputRow[] = [];
  const statsMap = new Map(segmentStats.map((s) => [s.tag, s]));
  const promptMap = new Map<string, ImageGenerationPrompt>();

  // Index prompts by segment_id
  for (const prompt of prompts) {
    promptMap.set(prompt.segment_id, prompt);
  }

  // Index hypotheses by segment
  const hypothesesMap = new Map<SegmentTag, SegmentHypothesis[]>();
  for (const hypothesis of hypotheses) {
    if (!hypothesesMap.has(hypothesis.segment_tag)) {
      hypothesesMap.set(hypothesis.segment_tag, []);
    }
    hypothesesMap.get(hypothesis.segment_tag)!.push(hypothesis);
  }

  for (const brief of briefs) {
    const stats = statsMap.get(brief.segment_tag);
    const prompt = promptMap.get(brief.segment_id);
    const segmentHypotheses = hypothesesMap.get(brief.segment_tag) || [];

    // Calculate priority score (higher is more important)
    const priorityScore = calculatePriorityScore(brief.segment_tag, stats);

    // Estimate revenue potential
    const estimatedRevenue = stats
      ? stats.average_revenue * stats.customer_count * 0.1 // Assume 10% lift potential
      : 0;

    // Get relevant KPIs from hypotheses
    const kpis = segmentHypotheses
      .slice(0, 3)
      .map((h) => h.kpi)
      .filter((kpi, index, self) => self.indexOf(kpi) === index);

    rows.push({
      segment_id: brief.segment_id,
      segment_name: brief.micro_segment_name || brief.segment_tag,
      micro_segment_id: brief.micro_segment_id,
      micro_segment_name: brief.micro_segment_name,

      email_subject_line: brief.subject_lines[0],
      hero_headline: brief.hero_headlines[0],
      hero_body_copy: brief.supporting_body_copy,
      cta_text: brief.cta_text,

      image_generation_prompt: prompt?.image_generation_prompt || '',

      segment_kpis: kpis,
      hypothesis_id: segmentHypotheses[0]?.hypothesis_id,

      esp_segment_key: `klaviyo_${slugify(brief.segment_id)}`,
      klaviyo_segment_id: undefined, // Would be populated after Klaviyo segment creation

      customer_count: stats?.customer_count || 0,
      estimated_revenue_potential: estimatedRevenue,
      priority_score: priorityScore,

      status: brief.compliance_checked ? 'reviewed' : 'draft',
      created_at: brief.created_at,
      updated_at: new Date(),
    });
  }

  // Sort by priority score descending
  rows.sort((a, b) => b.priority_score - a.priority_score);

  return rows;
}

/**
 * Calculate priority score for a segment
 */
function calculatePriorityScore(tag: SegmentTag, stats?: SegmentStats): number {
  // Base priority by segment type
  const basePriority: Record<SegmentTag, number> = {
    'VIP': 100,
    'At Risk': 90,
    'High Potential': 85,
    'Loyal Repeat': 80,
    'Churned': 70,
    'One-Time Buyers': 65,
    'Engaged Non-Buyer': 60,
    'Discount-Driven': 50,
    'Cold Subscribers': 20,
  };

  let score = basePriority[tag];

  // Adjust by segment size (larger segments get slight boost)
  if (stats) {
    if (stats.customer_count > 10000) score += 10;
    else if (stats.customer_count > 1000) score += 5;

    // Adjust by revenue potential
    if (stats.total_revenue > 100000) score += 10;
    else if (stats.total_revenue > 10000) score += 5;
  }

  return score;
}

/**
 * Export data as CSV string
 */
export function exportToCsv(rows: OpsOutputRow[]): string {
  const headers = [
    'segment_id',
    'segment_name',
    'micro_segment_id',
    'micro_segment_name',
    'email_subject_line',
    'hero_headline',
    'hero_body_copy',
    'cta_text',
    'segment_kpis',
    'esp_segment_key',
    'customer_count',
    'estimated_revenue_potential',
    'priority_score',
    'status',
  ];

  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const values = [
      escapeCSV(row.segment_id),
      escapeCSV(row.segment_name),
      escapeCSV(row.micro_segment_id || ''),
      escapeCSV(row.micro_segment_name || ''),
      escapeCSV(row.email_subject_line),
      escapeCSV(row.hero_headline),
      escapeCSV(row.hero_body_copy),
      escapeCSV(row.cta_text),
      escapeCSV(row.segment_kpis.join('; ')),
      escapeCSV(row.esp_segment_key),
      row.customer_count.toString(),
      row.estimated_revenue_potential.toFixed(2),
      row.priority_score.toString(),
      row.status,
    ];
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Escape value for CSV
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export data as JSON
 */
export function exportToJson(rows: OpsOutputRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * Export per-segment CSVs
 */
export function exportPerSegmentCsvs(rows: OpsOutputRow[]): Map<SegmentTag, string> {
  const csvMap = new Map<SegmentTag, string>();

  // Group rows by parent segment
  const groupedRows = new Map<SegmentTag, OpsOutputRow[]>();
  for (const row of rows) {
    // Extract parent segment from segment_name
    const parentSegment = row.segment_name.split(' ')[0] as SegmentTag;
    const actualParent = Object.keys({
      'VIP': true,
      'Loyal': true,
      'High': true,
      'At': true,
      'Churned': true,
      'One-Time': true,
      'Discount-Driven': true,
      'Engaged': true,
      'Cold': true,
    }).find((key) => row.segment_name.startsWith(key));

    // Find the actual segment tag
    let segmentTag: SegmentTag = 'VIP'; // default
    for (const tag of ['VIP', 'Loyal Repeat', 'High Potential', 'At Risk', 'Churned', 'One-Time Buyers', 'Discount-Driven', 'Engaged Non-Buyer', 'Cold Subscribers'] as SegmentTag[]) {
      if (row.segment_name === tag || row.segment_name.startsWith(tag.split(' ')[0])) {
        segmentTag = tag;
        break;
      }
    }

    if (!groupedRows.has(segmentTag)) {
      groupedRows.set(segmentTag, []);
    }
    groupedRows.get(segmentTag)!.push(row);
  }

  for (const [tag, segmentRows] of groupedRows) {
    csvMap.set(tag, exportToCsv(segmentRows));
  }

  return csvMap;
}

/**
 * Generate Klaviyo-ready segment definitions
 */
export function generateKlaviyoSegmentDefinitions(
  segmentResults: CustomerSegmentResult[],
  segmentStats: SegmentStats[]
): KlaviyoSegmentDefinition[] {
  const definitions: KlaviyoSegmentDefinition[] = [];
  const statsMap = new Map(segmentStats.map((s) => [s.tag, s]));

  for (const tag of ['VIP', 'Loyal Repeat', 'High Potential', 'At Risk', 'Churned', 'One-Time Buyers', 'Discount-Driven', 'Engaged Non-Buyer', 'Cold Subscribers'] as SegmentTag[]) {
    const stats = statsMap.get(tag);
    const profileIds = segmentResults
      .filter((r) => r.segment_tags.includes(tag))
      .map((r) => r.profile_id);

    definitions.push({
      name: `[Auto] ${tag}`,
      description: getSegmentDescription(tag),
      profile_ids: profileIds,
      estimated_size: stats?.customer_count || profileIds.length,
      is_dynamic: false, // Static upload
      tags: ['auto-generated', 'lifecycle', tag.toLowerCase().replace(/\s+/g, '-')],
    });
  }

  return definitions;
}

interface KlaviyoSegmentDefinition {
  name: string;
  description: string;
  profile_ids: string[];
  estimated_size: number;
  is_dynamic: boolean;
  tags: string[];
}

/**
 * Get human-readable segment description
 */
function getSegmentDescription(tag: SegmentTag): string {
  const descriptions: Record<SegmentTag, string> = {
    'VIP': 'Top 10% revenue customers with high purchase frequency',
    'Loyal Repeat': 'Customers with 3+ orders and consistent purchase patterns',
    'High Potential': 'First-time buyers with above-average order value',
    'At Risk': 'Previously active customers who are overdue for purchase',
    'Churned': 'Customers who have likely churned (90+ days inactive)',
    'One-Time Buyers': 'Single-purchase customers who haven\'t returned',
    'Discount-Driven': 'Customers who primarily buy with promotions',
    'Engaged Non-Buyer': 'Highly engaged subscribers who haven\'t purchased',
    'Cold Subscribers': 'Subscribers with no recent engagement',
  };
  return descriptions[tag];
}

/**
 * Generate complete pipeline output
 */
export function generatePipelineOutput(
  segmentResults: CustomerSegmentResult[],
  segmentStats: SegmentStats[],
  microSegments: Map<SegmentTag, MicroSegment[]>,
  hypotheses: SegmentHypothesis[],
  briefs: CreativeBrief[],
  complianceResults: ComplianceCheckResult[],
  prompts: ImageGenerationPrompt[]
): PipelineOutput {
  const runId = `run_${uuidv4()}`;

  // Generate ops rows
  const opsRows = generateOpsRows(briefs, prompts, segmentStats, hypotheses);

  // Flatten micro-segments for output
  const allMicroSegments: MicroSegment[] = [];
  for (const segments of microSegments.values()) {
    allMicroSegments.push(...segments);
  }

  // Build segment outputs
  const segmentOutputs = segmentStats.map((stats) => ({
    segment_id: `seg_${slugify(stats.tag)}`,
    segment_tag: stats.tag,
    definition: {
      tag: stats.tag,
      description: getSegmentDescription(stats.tag),
      rules: [],
      logical_operator: 'AND' as const,
      priority: 0,
      is_exclusive: false,
    },
    stats,
    micro_segments: microSegments.get(stats.tag) || [],
    hypotheses: hypotheses.filter((h) => h.segment_tag === stats.tag),
    customers: segmentResults.filter((r) => r.segment_tags.includes(stats.tag)),
  }));

  return {
    run_id: runId,
    run_at: new Date(),

    total_customers_processed: segmentResults.length,
    total_segments: segmentStats.length,
    total_micro_segments: allMicroSegments.length,
    total_briefs_generated: briefs.length,

    segment_results: segmentOutputs,
    creative_briefs: briefs,
    compliance_results: complianceResults,
    image_prompts: prompts,
    ops_rows: opsRows,

    export_formats_available: ['json', 'csv', 'klaviyo'],
  };
}

/**
 * Generate summary report
 */
export function generateSummaryReport(output: PipelineOutput): string {
  const lines: string[] = [
    '# Segmentation Pipeline Summary',
    '',
    `**Run ID:** ${output.run_id}`,
    `**Run Date:** ${output.run_at.toISOString()}`,
    '',
    '## Overview',
    `- Total Customers Processed: ${output.total_customers_processed.toLocaleString()}`,
    `- Total Segments: ${output.total_segments}`,
    `- Total Micro-Segments: ${output.total_micro_segments}`,
    `- Total Briefs Generated: ${output.total_briefs_generated}`,
    '',
    '## Segment Distribution',
    '',
  ];

  for (const segmentOutput of output.segment_results) {
    const percentage = output.total_customers_processed > 0
      ? ((segmentOutput.customers.length / output.total_customers_processed) * 100).toFixed(1)
      : '0';
    lines.push(
      `- **${segmentOutput.segment_tag}**: ${segmentOutput.customers.length.toLocaleString()} customers (${percentage}%)`
    );
    lines.push(`  - Average Revenue: $${segmentOutput.stats.average_revenue.toFixed(2)}`);
    lines.push(`  - Total Revenue: $${segmentOutput.stats.total_revenue.toLocaleString()}`);
    lines.push(`  - Micro-Segments: ${segmentOutput.micro_segments.length}`);
    lines.push('');
  }

  lines.push('## Compliance Status');
  const compliant = output.compliance_results.filter((r) => r.is_compliant).length;
  const autoFixed = output.compliance_results.filter((r) => r.auto_fixed).length;
  lines.push(`- Compliant Briefs: ${compliant}/${output.compliance_results.length}`);
  lines.push(`- Auto-Fixed Briefs: ${autoFixed}`);
  lines.push('');

  lines.push('## Top Priority Segments');
  const topRows = output.ops_rows.slice(0, 5);
  for (const row of topRows) {
    lines.push(`1. **${row.segment_name}** (Priority: ${row.priority_score})`);
    lines.push(`   - Customers: ${row.customer_count.toLocaleString()}`);
    lines.push(`   - Est. Revenue Potential: $${row.estimated_revenue_potential.toLocaleString()}`);
  }

  return lines.join('\n');
}

/**
 * Export formats type
 */
export type ExportFormat = 'json' | 'csv' | 'klaviyo';

/**
 * Export output in specified format
 */
export function exportOutput(
  output: PipelineOutput,
  format: ExportFormat
): string | Map<SegmentTag, string> {
  switch (format) {
    case 'json':
      return JSON.stringify(output, null, 2);
    case 'csv':
      return exportToCsv(output.ops_rows);
    case 'klaviyo':
      return JSON.stringify(
        generateKlaviyoSegmentDefinitions(
          output.segment_results.flatMap((s) => s.customers),
          output.segment_results.map((s) => s.stats)
        ),
        null,
        2
      );
    default:
      return exportToJson(output.ops_rows);
  }
}
