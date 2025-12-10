/**
 * Creative Brief and Output Types
 * Marketing creative generation structures
 */

import type { SegmentTag } from './segments';

// Creative brief for a segment/micro-segment
export interface CreativeBrief {
  brief_id: string;
  segment_id: string;
  segment_tag: SegmentTag;
  micro_segment_id?: string;
  micro_segment_name?: string;

  // Positioning
  primary_emotion: EmotionType;
  secondary_emotions: EmotionType[];
  positioning_statement: string;
  value_proposition: string;

  // Copy elements
  subject_lines: string[];
  hero_headlines: string[];
  supporting_body_copy: string;
  cta_text: string;
  cta_variants: string[];

  // Visual guidance
  visual_guidance: VisualGuidance;

  // Metadata
  created_at: Date;
  version: number;
  approved: boolean;
  compliance_checked: boolean;
}

export type EmotionType =
  | 'excitement'
  | 'urgency'
  | 'exclusivity'
  | 'nostalgia'
  | 'trust'
  | 'curiosity'
  | 'comfort'
  | 'aspiration'
  | 'gratitude'
  | 'fomo'
  | 'delight'
  | 'relief'
  | 'pride'
  | 'belonging';

export interface VisualGuidance {
  scene_description: string;
  style: VisualStyle;
  mood: string;
  primary_colors: string[];
  secondary_colors: string[];
  layout_type: LayoutType;
  imagery_notes: string;
  avoid: string[];
  product_focus: boolean;
  lifestyle_elements: string[];
}

export type VisualStyle =
  | 'minimal'
  | 'bold'
  | 'elegant'
  | 'playful'
  | 'warm'
  | 'clean'
  | 'luxurious'
  | 'rustic'
  | 'modern'
  | 'vintage';

export type LayoutType =
  | 'hero-centered'
  | 'hero-left'
  | 'hero-right'
  | 'split-screen'
  | 'product-grid'
  | 'full-bleed'
  | 'text-overlay'
  | 'minimal-product';

// Brand guardrails configuration
export interface BrandGuardrails {
  brand_name: string;
  brand_voice: BrandVoice;

  // Banned content
  banned_words: string[];
  banned_phrases: string[];
  competitor_mentions: string[];

  // Required elements
  required_disclaimer?: string;
  legal_footer?: string;

  // Tone rules
  avoid_tones: string[];
  preferred_tones: string[];

  // Visual rules
  brand_colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
    forbidden: string[];
  };

  // Compliance
  compliance_rules: ComplianceRule[];
}

export interface BrandVoice {
  personality: string[];
  tone: string[];
  language_style: 'formal' | 'casual' | 'conversational' | 'professional';
  sentence_style: 'short' | 'medium' | 'varied';
  use_contractions: boolean;
  use_emoji: boolean;
  max_exclamation_marks: number;
}

export interface ComplianceRule {
  rule_id: string;
  category: 'legal' | 'brand' | 'accessibility' | 'privacy';
  description: string;
  check_type: 'banned_word' | 'required_element' | 'pattern' | 'custom';
  pattern?: string; // regex pattern
  severity: 'error' | 'warning';
}

// Compliance check result
export interface ComplianceCheckResult {
  brief_id: string;
  is_compliant: boolean;
  violations: ComplianceViolation[];
  warnings: ComplianceViolation[];
  checked_at: Date;
  auto_fixed: boolean;
  fixed_brief?: CreativeBrief;
}

export interface ComplianceViolation {
  rule_id: string;
  field: string;
  original_value: string;
  violation_type: string;
  severity: 'error' | 'warning';
  suggested_fix?: string;
  auto_fixable: boolean;
}

// Image generation prompt
export interface ImageGenerationPrompt {
  prompt_id: string;
  segment_id: string;
  micro_segment_id?: string;
  asset_type: AssetType;

  // The actual prompt text
  image_generation_prompt: string;

  // Technical specifications
  dimensions: {
    width: number;
    height: number;
    aspect_ratio: string;
  };

  // Style modifiers
  style_modifiers: string[];
  negative_prompts: string[];

  // Reference
  brief_id: string;
  created_at: Date;
}

export type AssetType =
  | 'email_hero'
  | 'email_product'
  | 'sms_image'
  | 'social_post'
  | 'banner_ad'
  | 'landing_hero'
  | 'thumbnail';

// Final ops-ready output row
export interface OpsOutputRow {
  segment_id: string;
  segment_name: string;
  micro_segment_id?: string;
  micro_segment_name?: string;

  // Copy
  email_subject_line: string;
  hero_headline: string;
  hero_body_copy: string;
  cta_text: string;

  // Image
  image_generation_prompt: string;

  // Tracking
  segment_kpis: string[];
  hypothesis_id?: string;

  // ESP integration
  esp_segment_key: string;
  klaviyo_segment_id?: string;

  // Metadata
  customer_count: number;
  estimated_revenue_potential: number;
  priority_score: number;

  // Status
  status: 'draft' | 'reviewed' | 'approved' | 'active';
  created_at: Date;
  updated_at: Date;
}

// Complete pipeline output
export interface PipelineOutput {
  run_id: string;
  run_at: Date;

  // Summary
  total_customers_processed: number;
  total_segments: number;
  total_micro_segments: number;
  total_briefs_generated: number;

  // Outputs
  segment_results: import('./segments').SegmentOutput[];
  creative_briefs: CreativeBrief[];
  compliance_results: ComplianceCheckResult[];
  image_prompts: ImageGenerationPrompt[];
  ops_rows: OpsOutputRow[];

  // For export
  export_formats_available: ('json' | 'csv' | 'klaviyo')[];
}
