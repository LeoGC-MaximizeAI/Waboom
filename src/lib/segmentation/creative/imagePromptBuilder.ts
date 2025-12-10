/**
 * Image Prompt Builder
 * Generates structured prompts for image generation (e.g., for Gemini Banana Pro)
 */

import type { SegmentTag } from '../types/segments';
import type {
  CreativeBrief,
  ImageGenerationPrompt,
  AssetType,
  VisualStyle,
} from '../types/creative';
import { v4 as uuidv4 } from '../engine/utils';

/**
 * Asset type specifications
 */
const ASSET_SPECS: Record<AssetType, AssetSpecification> = {
  email_hero: {
    width: 600,
    height: 400,
    aspect_ratio: '3:2',
    description: 'Email hero banner image',
    style_modifiers: ['high contrast', 'clear focal point', 'email-safe colors'],
  },
  email_product: {
    width: 300,
    height: 300,
    aspect_ratio: '1:1',
    description: 'Email product showcase',
    style_modifiers: ['product focus', 'clean background', 'high detail'],
  },
  sms_image: {
    width: 600,
    height: 600,
    aspect_ratio: '1:1',
    description: 'SMS/MMS image',
    style_modifiers: ['simple composition', 'bold visuals', 'mobile-optimized'],
  },
  social_post: {
    width: 1080,
    height: 1080,
    aspect_ratio: '1:1',
    description: 'Social media post',
    style_modifiers: ['scroll-stopping', 'vibrant', 'shareable'],
  },
  banner_ad: {
    width: 728,
    height: 90,
    aspect_ratio: '8:1',
    description: 'Display banner ad',
    style_modifiers: ['horizontal composition', 'clear CTA area', 'brand-forward'],
  },
  landing_hero: {
    width: 1920,
    height: 1080,
    aspect_ratio: '16:9',
    description: 'Landing page hero',
    style_modifiers: ['cinematic', 'high resolution', 'text overlay space'],
  },
  thumbnail: {
    width: 400,
    height: 300,
    aspect_ratio: '4:3',
    description: 'Thumbnail image',
    style_modifiers: ['clear at small size', 'high contrast', 'simple composition'],
  },
};

interface AssetSpecification {
  width: number;
  height: number;
  aspect_ratio: string;
  description: string;
  style_modifiers: string[];
}

/**
 * Visual style prompt fragments
 */
const STYLE_PROMPTS: Record<VisualStyle, string> = {
  minimal: 'minimalist design, clean lines, ample white space, simple composition',
  bold: 'bold colors, strong contrast, dynamic composition, impactful visuals',
  elegant: 'elegant and refined, sophisticated aesthetics, premium look, subtle details',
  playful: 'playful and fun, bright colors, whimsical elements, energetic composition',
  warm: 'warm tones, cozy atmosphere, inviting visuals, soft lighting',
  clean: 'clean and modern, crisp edges, organized layout, professional appearance',
  luxurious: 'luxury aesthetics, rich textures, gold accents, premium materials',
  rustic: 'rustic charm, natural textures, earthy tones, handcrafted feel',
  modern: 'contemporary design, sleek aesthetics, cutting-edge style, fresh approach',
  vintage: 'vintage inspired, retro aesthetics, nostalgic feel, classic elements',
};

/**
 * Segment-specific imagery guidance
 */
const SEGMENT_IMAGERY: Record<SegmentTag, string> = {
  VIP: 'exclusive VIP experience, luxury lifestyle, premium quality, sophisticated setting',
  'Loyal Repeat': 'familiar comfort, trusted relationship, community belonging, warm connection',
  'High Potential': 'exciting discovery, new beginnings, curated selection, personalized experience',
  'At Risk': 'welcoming return, nostalgic reminder, fresh updates, reconnection moment',
  Churned: 'new chapter, transformation, fresh start, evolved brand',
  'One-Time Buyers': 'next step, continued journey, more to explore, building relationship',
  'Discount-Driven': 'great value, smart savings, deal excitement, savvy shopping',
  'Engaged Non-Buyer': 'first purchase moment, taking the leap, trust building, getting started',
  'Cold Subscribers': 'gentle reconnection, preference update, staying in touch, choice and control',
};

/**
 * Build an image generation prompt from a creative brief
 */
export function buildImagePrompt(
  brief: CreativeBrief,
  assetType: AssetType,
  brandContext?: BrandImageContext
): ImageGenerationPrompt {
  const spec = ASSET_SPECS[assetType];
  const stylePrompt = STYLE_PROMPTS[brief.visual_guidance.style];
  const segmentImagery = SEGMENT_IMAGERY[brief.segment_tag];

  // Build the main prompt
  const promptParts: string[] = [
    `Generate a ${spec.description} for "${brief.micro_segment_name || brief.segment_tag}" customer segment.`,
    '',
    '## Scene Description',
    brief.visual_guidance.scene_description,
    '',
    '## Visual Style',
    stylePrompt,
    '',
    '## Mood & Atmosphere',
    `Mood: ${brief.visual_guidance.mood}`,
    `Primary emotion to convey: ${brief.primary_emotion}`,
    '',
    '## Color Palette',
    `Primary colors: ${brief.visual_guidance.primary_colors.join(', ')}`,
    `Secondary colors: ${brief.visual_guidance.secondary_colors.join(', ')}`,
    '',
    '## Composition',
    `Layout: ${brief.visual_guidance.layout_type}`,
    `Product focus: ${brief.visual_guidance.product_focus ? 'Yes, product should be prominent' : 'No, lifestyle/mood focus'}`,
    '',
    '## Lifestyle Elements',
    brief.visual_guidance.lifestyle_elements.join(', '),
    '',
    '## Segment Context',
    segmentImagery,
    '',
    '## Imagery Notes',
    brief.visual_guidance.imagery_notes,
  ];

  // Add brand context if provided
  if (brandContext) {
    promptParts.push(
      '',
      '## Brand Guidelines',
      `Brand: ${brandContext.brand_name}`,
      `Brand style: ${brandContext.brand_style}`,
      brandContext.brand_elements ? `Include: ${brandContext.brand_elements}` : '',
    );
  }

  // Add technical specifications
  promptParts.push(
    '',
    '## Technical Specifications',
    `Dimensions: ${spec.width}x${spec.height}px`,
    `Aspect ratio: ${spec.aspect_ratio}`,
    '',
    '## Additional Modifiers',
    spec.style_modifiers.join(', '),
  );

  // Build negative prompts (things to avoid)
  const negativePrompts: string[] = [
    ...brief.visual_guidance.avoid,
    'text overlays',
    'watermarks',
    'logos',
    'low quality',
    'blurry',
    'distorted',
    'unrealistic proportions',
  ];

  // Add segment-specific negatives
  if (brief.segment_tag === 'VIP') {
    negativePrompts.push('discount badges', 'sale signs', 'mass-market imagery');
  }
  if (brief.segment_tag === 'Cold Subscribers') {
    negativePrompts.push('aggressive sales imagery', 'promotional content', 'urgency indicators');
  }

  return {
    prompt_id: `prompt_${uuidv4()}`,
    segment_id: brief.segment_id,
    micro_segment_id: brief.micro_segment_id,
    asset_type: assetType,
    image_generation_prompt: promptParts.filter(Boolean).join('\n'),
    dimensions: {
      width: spec.width,
      height: spec.height,
      aspect_ratio: spec.aspect_ratio,
    },
    style_modifiers: [...spec.style_modifiers, stylePrompt],
    negative_prompts: negativePrompts,
    brief_id: brief.brief_id,
    created_at: new Date(),
  };
}

interface BrandImageContext {
  brand_name: string;
  brand_style: string;
  brand_elements?: string;
}

/**
 * Build prompts for all standard asset types
 */
export function buildAllAssetPrompts(
  brief: CreativeBrief,
  brandContext?: BrandImageContext,
  assetTypes: AssetType[] = ['email_hero', 'social_post', 'thumbnail']
): ImageGenerationPrompt[] {
  return assetTypes.map((assetType) => buildImagePrompt(brief, assetType, brandContext));
}

/**
 * Build prompts for all briefs
 */
export function buildPromptsForBriefs(
  briefs: CreativeBrief[],
  brandContext?: BrandImageContext,
  assetTypes: AssetType[] = ['email_hero']
): ImageGenerationPrompt[] {
  const prompts: ImageGenerationPrompt[] = [];

  for (const brief of briefs) {
    for (const assetType of assetTypes) {
      prompts.push(buildImagePrompt(brief, assetType, brandContext));
    }
  }

  return prompts;
}

/**
 * Format prompt for API consumption (simplified string format)
 */
export function formatPromptForAPI(prompt: ImageGenerationPrompt): {
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  metadata: Record<string, string>;
} {
  return {
    prompt: prompt.image_generation_prompt,
    negative_prompt: prompt.negative_prompts.join(', '),
    width: prompt.dimensions.width,
    height: prompt.dimensions.height,
    metadata: {
      segment_id: prompt.segment_id,
      micro_segment_id: prompt.micro_segment_id || '',
      asset_type: prompt.asset_type,
      brief_id: prompt.brief_id,
    },
  };
}

/**
 * Build a concise prompt (for models with length limits)
 */
export function buildConcisePrompt(
  brief: CreativeBrief,
  assetType: AssetType,
  maxLength: number = 500
): string {
  const spec = ASSET_SPECS[assetType];
  const stylePrompt = STYLE_PROMPTS[brief.visual_guidance.style];
  const segmentImagery = SEGMENT_IMAGERY[brief.segment_tag];

  const prompt = [
    `${spec.description} for ${brief.segment_tag} customers.`,
    brief.visual_guidance.scene_description,
    stylePrompt,
    `Mood: ${brief.visual_guidance.mood}`,
    `Colors: ${brief.visual_guidance.primary_colors.join(', ')}`,
    segmentImagery,
  ].join(' ');

  if (prompt.length <= maxLength) {
    return prompt;
  }

  return prompt.slice(0, maxLength - 3) + '...';
}

/**
 * Get available asset types
 */
export function getAssetTypes(): AssetType[] {
  return Object.keys(ASSET_SPECS) as AssetType[];
}

/**
 * Get asset specification
 */
export function getAssetSpec(assetType: AssetType): AssetSpecification {
  return ASSET_SPECS[assetType];
}

/**
 * Export prompts as JSON for external processing
 */
export function exportPromptsAsJson(prompts: ImageGenerationPrompt[]): string {
  const exportData = prompts.map((prompt) => ({
    segment_id: prompt.segment_id,
    micro_segment_id: prompt.micro_segment_id,
    asset_type: prompt.asset_type,
    image_generation_prompt: prompt.image_generation_prompt,
    dimensions: prompt.dimensions,
    negative_prompts: prompt.negative_prompts,
    brief_id: prompt.brief_id,
  }));

  return JSON.stringify(exportData, null, 2);
}

/**
 * Batch prompts by segment for organized processing
 */
export function batchPromptsBySegment(
  prompts: ImageGenerationPrompt[]
): Map<string, ImageGenerationPrompt[]> {
  const batches = new Map<string, ImageGenerationPrompt[]>();

  for (const prompt of prompts) {
    const key = prompt.segment_id;
    if (!batches.has(key)) {
      batches.set(key, []);
    }
    batches.get(key)!.push(prompt);
  }

  return batches;
}
