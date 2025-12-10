/**
 * Segmentation Library
 * Complete customer segmentation and creative generation pipeline
 *
 * @module segmentation
 *
 * @example
 * ```typescript
 * import { runPipeline, quickSegment } from './lib/segmentation';
 *
 * // Full pipeline with Klaviyo data
 * const output = await runPipeline(klaviyoProfiles, eventsMap, {
 *   generateMicroSegments: true,
 *   generateCreativeBriefs: true,
 * });
 *
 * // Quick segmentation only
 * const { results, stats } = quickSegment(normalizedProfiles);
 * ```
 */

// Main pipeline
export {
  runPipeline,
  runSimplePipeline,
  quickSegment,
  DEFAULT_CONFIG,
  type PipelineConfig,
} from './pipeline';

// Types
export * from './types';

// Preprocessing
export * from './preprocessing';

// Segmentation Engine
export * from './engine';

// Creative Generation
export * from './creative';

// Output Formatting
export * from './output';
