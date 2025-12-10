/**
 * Segmentation Pipeline Orchestrator
 * Main entry point for the full segmentation → creative generation pipeline
 */

import type { KlaviyoProfile, KlaviyoEvent, CustomerProfile } from './types/customer';
import type {
  SegmentTag,
  AccountThresholds,
  CustomerSegmentResult,
  SegmentStats,
  MicroSegment,
  SegmentHypothesis,
} from './types/segments';
import type {
  CreativeBrief,
  ImageGenerationPrompt,
  BrandGuardrails,
  ComplianceCheckResult,
  PipelineOutput,
  OpsOutputRow,
  AssetType,
} from './types/creative';

// Import modules
import { normalizeProfile, processBatch, flattenToTabular } from './preprocessing/dataPreprocessor';
import { calculateThresholds, ThresholdConfig, getSummaryStats } from './preprocessing/thresholdCalculator';
import {
  classifyCustomer,
  classifyBatch,
  getSegmentDistribution,
  getSegmentStats,
  SEGMENT_DEFINITIONS,
} from './engine/segmentClassifier';
import { generateAllHypotheses, generateHypothesesForSegment } from './engine/hypothesisGenerator';
import {
  generateMicroSegments,
  generateAllMicroSegments,
  getViableMicroSegments,
} from './engine/microSegmentation';
import { generateCreativeBrief, generateAllBriefs, exportBriefs } from './creative/briefGenerator';
import {
  validateBrief,
  validateBriefs,
  DEFAULT_GUARDRAILS,
  generateComplianceReport,
  getFixedBriefs,
} from './creative/brandGuardrails';
import {
  buildImagePrompt,
  buildPromptsForBriefs,
  buildAllAssetPrompts,
  formatPromptForAPI,
} from './creative/imagePromptBuilder';
import {
  generateOpsRows,
  generatePipelineOutput,
  generateSummaryReport,
  exportToCsv,
  exportToJson,
  exportOutput,
} from './output/outputFormatter';
import { chunk } from './engine/utils';

/**
 * Pipeline configuration options
 */
export interface PipelineConfig {
  // Batch processing
  batchSize: number;

  // Threshold calculation
  thresholdConfig?: ThresholdConfig;

  // Brand guardrails
  brandGuardrails?: BrandGuardrails;

  // Asset types to generate prompts for
  assetTypes?: AssetType[];

  // Brand context for image prompts
  brandContext?: {
    brand_name: string;
    brand_style: string;
    brand_elements?: string;
  };

  // Processing options
  generateMicroSegments: boolean;
  generateHypotheses: boolean;
  generateCreativeBriefs: boolean;
  validateCompliance: boolean;
  generateImagePrompts: boolean;

  // Output options
  outputFormats: ('json' | 'csv' | 'klaviyo')[];

  // Callbacks for progress tracking
  onProgress?: (stage: string, progress: number, total: number) => void;
  onStageComplete?: (stage: string, result: unknown) => void;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_CONFIG: PipelineConfig = {
  batchSize: 10000,
  thresholdConfig: {},
  brandGuardrails: DEFAULT_GUARDRAILS,
  assetTypes: ['email_hero'],
  generateMicroSegments: true,
  generateHypotheses: true,
  generateCreativeBriefs: true,
  validateCompliance: true,
  generateImagePrompts: true,
  outputFormats: ['json', 'csv'],
};

/**
 * Pipeline execution context
 */
interface PipelineContext {
  config: PipelineConfig;
  startTime: Date;
  profiles: CustomerProfile[];
  thresholds?: AccountThresholds;
  segmentResults?: CustomerSegmentResult[];
  segmentStats?: SegmentStats[];
  microSegments?: Map<SegmentTag, MicroSegment[]>;
  hypotheses?: SegmentHypothesis[];
  briefs?: CreativeBrief[];
  complianceResults?: ComplianceCheckResult[];
  imagePrompts?: ImageGenerationPrompt[];
}

/**
 * Run the complete segmentation pipeline
 */
export async function runPipeline(
  rawProfiles: KlaviyoProfile[],
  eventsMap: Map<string, KlaviyoEvent[]>,
  config: Partial<PipelineConfig> = {}
): Promise<PipelineOutput> {
  const fullConfig: PipelineConfig = { ...DEFAULT_CONFIG, ...config };
  const context: PipelineContext = {
    config: fullConfig,
    startTime: new Date(),
    profiles: [],
  };

  // Stage 1: Data Preprocessing
  reportProgress(fullConfig, 'preprocessing', 0, rawProfiles.length);
  context.profiles = await processProfiles(rawProfiles, eventsMap, fullConfig);
  reportStageComplete(fullConfig, 'preprocessing', { profileCount: context.profiles.length });

  // Stage 2: Calculate Thresholds
  reportProgress(fullConfig, 'thresholds', 0, 1);
  context.thresholds = calculateThresholds(context.profiles, fullConfig.thresholdConfig);
  reportStageComplete(fullConfig, 'thresholds', context.thresholds);

  // Stage 3: Segment Classification
  reportProgress(fullConfig, 'segmentation', 0, context.profiles.length);
  context.segmentResults = classifyBatch(context.profiles, context.thresholds);
  context.segmentStats = getSegmentStats(context.segmentResults, context.profiles);
  reportStageComplete(fullConfig, 'segmentation', {
    distribution: getSegmentDistribution(context.segmentResults),
  });

  // Stage 4: Generate Hypotheses (optional)
  if (fullConfig.generateHypotheses) {
    reportProgress(fullConfig, 'hypotheses', 0, 9);
    context.hypotheses = generateAllHypotheses(context.segmentStats);
    reportStageComplete(fullConfig, 'hypotheses', { count: context.hypotheses.length });
  } else {
    context.hypotheses = [];
  }

  // Stage 5: Generate Micro-Segments (optional)
  if (fullConfig.generateMicroSegments) {
    reportProgress(fullConfig, 'micro-segmentation', 0, 9);
    context.microSegments = generateAllMicroSegments(
      context.segmentResults,
      context.profiles,
      context.thresholds
    );
    reportStageComplete(fullConfig, 'micro-segmentation', {
      count: Array.from(context.microSegments.values()).flat().length,
    });
  } else {
    context.microSegments = new Map();
  }

  // Stage 6: Generate Creative Briefs (optional)
  if (fullConfig.generateCreativeBriefs) {
    reportProgress(fullConfig, 'creative-briefs', 0, context.segmentStats.length);
    context.briefs = generateAllBriefs(context.segmentStats, context.microSegments);
    reportStageComplete(fullConfig, 'creative-briefs', { count: context.briefs.length });
  } else {
    context.briefs = [];
  }

  // Stage 7: Validate Compliance (optional)
  if (fullConfig.validateCompliance && context.briefs.length > 0) {
    reportProgress(fullConfig, 'compliance', 0, context.briefs.length);
    context.complianceResults = validateBriefs(context.briefs, fullConfig.brandGuardrails);

    // Use fixed briefs where available
    const fixedBriefs = getFixedBriefs(context.complianceResults);
    if (fixedBriefs.length > 0) {
      const fixedBriefIds = new Set(fixedBriefs.map((b) => b.brief_id));
      context.briefs = [
        ...context.briefs.filter((b) => !fixedBriefIds.has(b.brief_id)),
        ...fixedBriefs,
      ];
    }

    reportStageComplete(fullConfig, 'compliance', generateComplianceReport(context.complianceResults));
  } else {
    context.complianceResults = [];
  }

  // Stage 8: Generate Image Prompts (optional)
  if (fullConfig.generateImagePrompts && context.briefs.length > 0) {
    reportProgress(fullConfig, 'image-prompts', 0, context.briefs.length);
    context.imagePrompts = buildPromptsForBriefs(
      context.briefs,
      fullConfig.brandContext,
      fullConfig.assetTypes
    );
    reportStageComplete(fullConfig, 'image-prompts', { count: context.imagePrompts.length });
  } else {
    context.imagePrompts = [];
  }

  // Stage 9: Generate Final Output
  reportProgress(fullConfig, 'output', 0, 1);
  const output = generatePipelineOutput(
    context.segmentResults,
    context.segmentStats,
    context.microSegments,
    context.hypotheses,
    context.briefs,
    context.complianceResults,
    context.imagePrompts
  );
  reportStageComplete(fullConfig, 'output', { runId: output.run_id });

  return output;
}

/**
 * Process profiles in batches
 */
async function processProfiles(
  rawProfiles: KlaviyoProfile[],
  eventsMap: Map<string, KlaviyoEvent[]>,
  config: PipelineConfig
): Promise<CustomerProfile[]> {
  const allProfiles: CustomerProfile[] = [];
  const batches = chunk(rawProfiles, config.batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const processed = processBatch(batch, eventsMap);
    allProfiles.push(...processed);

    if (config.onProgress) {
      config.onProgress('preprocessing', (i + 1) * config.batchSize, rawProfiles.length);
    }
  }

  return allProfiles;
}

/**
 * Report progress to callback
 */
function reportProgress(config: PipelineConfig, stage: string, progress: number, total: number): void {
  if (config.onProgress) {
    config.onProgress(stage, progress, total);
  }
}

/**
 * Report stage completion to callback
 */
function reportStageComplete(config: PipelineConfig, stage: string, result: unknown): void {
  if (config.onStageComplete) {
    config.onStageComplete(stage, result);
  }
}

/**
 * Run pipeline with raw data (simplified interface)
 */
export async function runSimplePipeline(
  profiles: CustomerProfile[],
  config: Partial<PipelineConfig> = {}
): Promise<PipelineOutput> {
  const fullConfig: PipelineConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate thresholds
  const thresholds = calculateThresholds(profiles, fullConfig.thresholdConfig);

  // Classify customers
  const segmentResults = classifyBatch(profiles, thresholds);
  const segmentStats = getSegmentStats(segmentResults, profiles);

  // Generate hypotheses
  const hypotheses = fullConfig.generateHypotheses ? generateAllHypotheses(segmentStats) : [];

  // Generate micro-segments
  const microSegments = fullConfig.generateMicroSegments
    ? generateAllMicroSegments(segmentResults, profiles, thresholds)
    : new Map<SegmentTag, MicroSegment[]>();

  // Generate briefs
  const briefs = fullConfig.generateCreativeBriefs
    ? generateAllBriefs(segmentStats, microSegments)
    : [];

  // Validate compliance
  const complianceResults = fullConfig.validateCompliance && briefs.length > 0
    ? validateBriefs(briefs, fullConfig.brandGuardrails)
    : [];

  // Generate image prompts
  const imagePrompts = fullConfig.generateImagePrompts && briefs.length > 0
    ? buildPromptsForBriefs(briefs, fullConfig.brandContext, fullConfig.assetTypes)
    : [];

  // Generate output
  return generatePipelineOutput(
    segmentResults,
    segmentStats,
    microSegments,
    hypotheses,
    briefs,
    complianceResults,
    imagePrompts
  );
}

/**
 * Quick segmentation only (no creative generation)
 */
export function quickSegment(
  profiles: CustomerProfile[],
  thresholdConfig?: ThresholdConfig
): {
  thresholds: AccountThresholds;
  results: CustomerSegmentResult[];
  stats: SegmentStats[];
  distribution: Record<SegmentTag, number>;
} {
  const thresholds = calculateThresholds(profiles, thresholdConfig);
  const results = classifyBatch(profiles, thresholds);
  const stats = getSegmentStats(results, profiles);
  const distribution = getSegmentDistribution(results);

  return { thresholds, results, stats, distribution };
}

/**
 * Export all module functions and types
 */
export {
  // Types
  type KlaviyoProfile,
  type KlaviyoEvent,
  type CustomerProfile,
  type SegmentTag,
  type AccountThresholds,
  type CustomerSegmentResult,
  type SegmentStats,
  type MicroSegment,
  type SegmentHypothesis,
  type CreativeBrief,
  type ImageGenerationPrompt,
  type BrandGuardrails,
  type ComplianceCheckResult,
  type PipelineOutput,
  type OpsOutputRow,
  type AssetType,

  // Preprocessing
  normalizeProfile,
  processBatch,
  flattenToTabular,
  calculateThresholds,
  getSummaryStats,

  // Segmentation
  classifyCustomer,
  classifyBatch,
  getSegmentDistribution,
  getSegmentStats,
  SEGMENT_DEFINITIONS,

  // Hypotheses
  generateAllHypotheses,
  generateHypothesesForSegment,

  // Micro-segmentation
  generateMicroSegments,
  generateAllMicroSegments,
  getViableMicroSegments,

  // Creative
  generateCreativeBrief,
  generateAllBriefs,
  exportBriefs,

  // Compliance
  validateBrief,
  validateBriefs,
  DEFAULT_GUARDRAILS,
  generateComplianceReport,
  getFixedBriefs,

  // Image prompts
  buildImagePrompt,
  buildPromptsForBriefs,
  buildAllAssetPrompts,
  formatPromptForAPI,

  // Output
  generateOpsRows,
  generatePipelineOutput,
  generateSummaryReport,
  exportToCsv,
  exportToJson,
  exportOutput,
};
