/**
 * Creative Brief Generator
 * Generates marketing creative briefs for segments and micro-segments
 */

import type { SegmentTag, MicroSegment, SegmentStats } from '../types/segments';
import type {
  CreativeBrief,
  EmotionType,
  VisualGuidance,
  VisualStyle,
  LayoutType,
} from '../types/creative';
import { v4 as uuidv4 } from '../engine/utils';

/**
 * Segment-specific creative templates
 */
const SEGMENT_CREATIVE_TEMPLATES: Record<SegmentTag, SegmentCreativeTemplate> = {
  VIP: {
    primary_emotion: 'exclusivity',
    secondary_emotions: ['pride', 'belonging'],
    positioning_angles: [
      'You\'re part of an exclusive circle',
      'Rewards for our most valued customers',
      'First access, always',
    ],
    value_proposition: 'As our most valued customer, you deserve first access and exclusive rewards.',
    subject_line_templates: [
      'Exclusive early access just for you',
      'VIP Preview: Before anyone else',
      'Your exclusive invitation awaits',
    ],
    headline_templates: [
      'You\'ve Earned This',
      'First Look, Just for You',
      'Exclusively Yours',
    ],
    body_copy_template: 'Your loyalty hasn\'t gone unnoticed. As one of our most valued customers, you get first access to our newest collection before anyone else.',
    cta_variants: ['Shop VIP Collection', 'Access Now', 'View Exclusive Offer'],
    visual_style: 'luxurious',
    mood: 'elegant and prestigious',
    layout_type: 'hero-centered',
    imagery_notes: 'Premium product photography, gold accents, sophisticated lighting',
    lifestyle_elements: ['luxury lifestyle', 'exclusive experiences', 'premium quality'],
    colors: {
      primary: ['#1a1a1a', '#d4af37'],
      secondary: ['#ffffff', '#f5f5f5'],
    },
    avoid: ['discount language', 'urgency tactics', 'mass-market imagery'],
  },

  'Loyal Repeat': {
    primary_emotion: 'gratitude',
    secondary_emotions: ['belonging', 'trust'],
    positioning_angles: [
      'Thank you for being with us',
      'Because you keep coming back',
      'Your favorites, always in stock',
    ],
    value_proposition: 'We appreciate your continued loyalty and want to make your experience even better.',
    subject_line_templates: [
      'A thank you from us to you',
      'Your loyalty rewards are ready',
      'Back for more? We saved your favorites',
    ],
    headline_templates: [
      'Welcome Back',
      'Thanks for Being You',
      'Your Favorites Await',
    ],
    body_copy_template: 'You\'re not just a customer - you\'re part of our community. Here\'s a little something to show our appreciation for your continued support.',
    cta_variants: ['Shop Your Favorites', 'Claim Reward', 'See What\'s New'],
    visual_style: 'warm',
    mood: 'welcoming and familiar',
    layout_type: 'hero-left',
    imagery_notes: 'Warm tones, familiar products, community imagery',
    lifestyle_elements: ['daily routines', 'trusted choices', 'community'],
    colors: {
      primary: ['#8b4513', '#f4a460'],
      secondary: ['#fff8dc', '#faebd7'],
    },
    avoid: ['aggressive sales language', 'new customer offers'],
  },

  'High Potential': {
    primary_emotion: 'curiosity',
    secondary_emotions: ['excitement', 'aspiration'],
    positioning_angles: [
      'Discover what makes us different',
      'Your first order was just the beginning',
      'There\'s so much more to explore',
    ],
    value_proposition: 'You\'ve discovered something special. Let us show you what else we have in store.',
    subject_line_templates: [
      'We think you\'ll love this too',
      'Based on your first order...',
      'Ready to discover more?',
    ],
    headline_templates: [
      'Your Journey Starts Here',
      'Discover Your Next Favorite',
      'More to Love',
    ],
    body_copy_template: 'Your first order was just the beginning. Based on what you loved, we\'ve curated a selection we think you\'ll adore.',
    cta_variants: ['Explore More', 'See Recommendations', 'Continue Shopping'],
    visual_style: 'modern',
    mood: 'exciting and discovery-focused',
    layout_type: 'product-grid',
    imagery_notes: 'Product discovery, exploration themes, curated collections',
    lifestyle_elements: ['discovery', 'new experiences', 'personalization'],
    colors: {
      primary: ['#4169e1', '#6495ed'],
      secondary: ['#f0f8ff', '#e6e6fa'],
    },
    avoid: ['pressure tactics', 'too many options'],
  },

  'At Risk': {
    primary_emotion: 'nostalgia',
    secondary_emotions: ['comfort', 'curiosity'],
    positioning_angles: [
      'We miss seeing you',
      'A lot has changed since you visited',
      'Your favorites are waiting',
    ],
    value_proposition: 'It\'s been a while! We\'ve got some exciting updates and your favorites are still here.',
    subject_line_templates: [
      'We miss you - here\'s what\'s new',
      'It\'s been too long',
      'Your favorites are waiting',
    ],
    headline_templates: [
      'We\'ve Missed You',
      'Time to Reconnect',
      'See What\'s New',
    ],
    body_copy_template: 'It\'s been a while since your last visit, and we\'ve missed you. Come back and see what\'s new - plus, your favorites are still waiting.',
    cta_variants: ['Come Back', 'See What\'s New', 'Reconnect Now'],
    visual_style: 'warm',
    mood: 'inviting and nostalgic',
    layout_type: 'split-screen',
    imagery_notes: 'Before/after themes, new arrivals alongside favorites',
    lifestyle_elements: ['reconnection', 'updates', 'memories'],
    colors: {
      primary: ['#ff7f50', '#ff6347'],
      secondary: ['#ffe4e1', '#fff0f5'],
    },
    avoid: ['guilt language', 'aggressive urgency'],
  },

  Churned: {
    primary_emotion: 'curiosity',
    secondary_emotions: ['fomo', 'nostalgia'],
    positioning_angles: [
      'A lot has changed - come see',
      'We\'d love to have you back',
      'Something special to welcome you home',
    ],
    value_proposition: 'We\'ve evolved since you last visited. Come back and discover what\'s new with a special welcome-back offer.',
    subject_line_templates: [
      'Things have changed - come see',
      'A special offer to welcome you back',
      'We\'d love another chance',
    ],
    headline_templates: [
      'Welcome Back',
      'We\'ve Changed',
      'Give Us Another Look',
    ],
    body_copy_template: 'A lot has changed since your last visit. We\'ve been working hard to improve, and we\'d love to show you what\'s new with a special welcome-back offer.',
    cta_variants: ['See What\'s New', 'Claim Your Offer', 'Shop Now'],
    visual_style: 'bold',
    mood: 'refreshed and inviting',
    layout_type: 'hero-centered',
    imagery_notes: 'New products, refreshed branding, transformation themes',
    lifestyle_elements: ['fresh starts', 'new beginnings', 'evolution'],
    colors: {
      primary: ['#32cd32', '#228b22'],
      secondary: ['#f0fff0', '#e8f5e9'],
    },
    avoid: ['desperation', 'begging language'],
  },

  'One-Time Buyers': {
    primary_emotion: 'excitement',
    secondary_emotions: ['trust', 'curiosity'],
    positioning_angles: [
      'Time for round two',
      'We have more you\'ll love',
      'Your next favorite is waiting',
    ],
    value_proposition: 'You made a great choice with your first order. We have more products we think you\'ll love just as much.',
    subject_line_templates: [
      'Ready for your next order?',
      'We have more you\'ll love',
      'Time for round two',
    ],
    headline_templates: [
      'Time for More',
      'Your Next Favorite',
      'Keep the Momentum Going',
    ],
    body_copy_template: 'Your first order was a hit - why stop there? We\'ve picked out some items we think you\'ll love just as much.',
    cta_variants: ['Shop Again', 'See Recommendations', 'Order Again'],
    visual_style: 'playful',
    mood: 'encouraging and fun',
    layout_type: 'hero-right',
    imagery_notes: 'Product recommendations, repeat purchase themes',
    lifestyle_elements: ['momentum', 'second chances', 'more to discover'],
    colors: {
      primary: ['#ff69b4', '#ff1493'],
      secondary: ['#fff0f5', '#ffe4e1'],
    },
    avoid: ['pressure', 'limited time language'],
  },

  'Discount-Driven': {
    primary_emotion: 'excitement',
    secondary_emotions: ['urgency', 'delight'],
    positioning_angles: [
      'The savings you love are here',
      'Your deal-hunting skills are needed',
      'Don\'t miss this sale',
    ],
    value_proposition: 'You love a great deal, and we\'ve got another one for you. Shop now and save big.',
    subject_line_templates: [
      'SALE: Your kind of deal is here',
      'The savings you\'ve been waiting for',
      'Deal alert just for you',
    ],
    headline_templates: [
      'Sale On Now',
      'Your Deal Awaits',
      'Save Big Today',
    ],
    body_copy_template: 'You know a good deal when you see one. This is that deal. Shop now before it\'s gone.',
    cta_variants: ['Shop the Sale', 'Save Now', 'Get the Deal'],
    visual_style: 'bold',
    mood: 'exciting and urgent',
    layout_type: 'text-overlay',
    imagery_notes: 'Bold sale graphics, price callouts, savings badges',
    lifestyle_elements: ['smart shopping', 'savings', 'value'],
    colors: {
      primary: ['#ff0000', '#dc143c'],
      secondary: ['#ffff00', '#ffd700'],
    },
    avoid: ['subtle messaging', 'premium positioning'],
  },

  'Engaged Non-Buyer': {
    primary_emotion: 'trust',
    secondary_emotions: ['curiosity', 'comfort'],
    positioning_angles: [
      'Ready to take the leap?',
      'What\'s holding you back?',
      'Your first purchase, made easy',
    ],
    value_proposition: 'We\'ve noticed you\'re interested. Here\'s a special offer to help you make your first purchase.',
    subject_line_templates: [
      'Ready to try us?',
      'A little something to get started',
      'Your first order made easy',
    ],
    headline_templates: [
      'Take the Leap',
      'Your First Order',
      'We\'re Ready When You Are',
    ],
    body_copy_template: 'We\'ve noticed you\'ve been checking us out. Here\'s a little incentive to help you take the first step.',
    cta_variants: ['Shop Now', 'Start Shopping', 'Make Your First Order'],
    visual_style: 'clean',
    mood: 'trustworthy and inviting',
    layout_type: 'minimal-product',
    imagery_notes: 'Approachable product shots, trust badges, social proof',
    lifestyle_elements: ['first steps', 'trust', 'getting started'],
    colors: {
      primary: ['#4682b4', '#5f9ea0'],
      secondary: ['#f0f8ff', '#e0ffff'],
    },
    avoid: ['too much text', 'overwhelming options'],
  },

  'Cold Subscribers': {
    primary_emotion: 'curiosity',
    secondary_emotions: ['trust', 'comfort'],
    positioning_angles: [
      'Still interested? Let us know',
      'Would you like to stay subscribed?',
      'We want to stay in touch - do you?',
    ],
    value_proposition: 'We haven\'t heard from you in a while. If you\'d still like to receive updates, let us know.',
    subject_line_templates: [
      'Still want to hear from us?',
      'Let us know you\'re still there',
      'Should we keep in touch?',
    ],
    headline_templates: [
      'Still There?',
      'Let\'s Reconnect',
      'Update Your Preferences',
    ],
    body_copy_template: 'We haven\'t seen you engage with our emails in a while. If you\'d still like to hear from us, click below to stay subscribed.',
    cta_variants: ['Yes, Keep Me Subscribed', 'Update Preferences', 'Stay Connected'],
    visual_style: 'minimal',
    mood: 'respectful and gentle',
    layout_type: 'minimal-product',
    imagery_notes: 'Simple, clean design with clear CTA focus',
    lifestyle_elements: ['communication', 'preferences', 'choice'],
    colors: {
      primary: ['#808080', '#696969'],
      secondary: ['#f5f5f5', '#dcdcdc'],
    },
    avoid: ['promotional content', 'sales language'],
  },
};

interface SegmentCreativeTemplate {
  primary_emotion: EmotionType;
  secondary_emotions: EmotionType[];
  positioning_angles: string[];
  value_proposition: string;
  subject_line_templates: string[];
  headline_templates: string[];
  body_copy_template: string;
  cta_variants: string[];
  visual_style: VisualStyle;
  mood: string;
  layout_type: LayoutType;
  imagery_notes: string;
  lifestyle_elements: string[];
  colors: {
    primary: string[];
    secondary: string[];
  };
  avoid: string[];
}

/**
 * Generate a creative brief for a segment
 */
export function generateCreativeBrief(
  segmentTag: SegmentTag,
  stats?: SegmentStats,
  microSegment?: MicroSegment
): CreativeBrief {
  const template = SEGMENT_CREATIVE_TEMPLATES[segmentTag];
  const briefId = `brief_${uuidv4()}`;

  // Customize subject lines and headlines for micro-segment if provided
  let subjectLines = [...template.subject_line_templates];
  let headlines = [...template.headline_templates];
  let bodyCopy = template.body_copy_template;
  let positioningStatement = template.positioning_angles[0];

  if (microSegment) {
    // Customize based on micro-segment characteristics
    const customizations = getMicroSegmentCustomizations(microSegment, template);
    subjectLines = customizations.subjectLines;
    headlines = customizations.headlines;
    bodyCopy = customizations.bodyCopy;
    positioningStatement = customizations.positioning;
  }

  const visualGuidance: VisualGuidance = {
    scene_description: `A ${template.mood} scene featuring ${template.lifestyle_elements.join(', ')}`,
    style: template.visual_style,
    mood: template.mood,
    primary_colors: template.colors.primary,
    secondary_colors: template.colors.secondary,
    layout_type: template.layout_type,
    imagery_notes: template.imagery_notes,
    avoid: template.avoid,
    product_focus: true,
    lifestyle_elements: template.lifestyle_elements,
  };

  return {
    brief_id: briefId,
    segment_id: microSegment?.micro_segment_id || `seg_${segmentTag.toLowerCase().replace(/\s+/g, '_')}`,
    segment_tag: segmentTag,
    micro_segment_id: microSegment?.micro_segment_id,
    micro_segment_name: microSegment?.name,

    primary_emotion: template.primary_emotion,
    secondary_emotions: template.secondary_emotions,
    positioning_statement: positioningStatement,
    value_proposition: template.value_proposition,

    subject_lines: subjectLines,
    hero_headlines: headlines,
    supporting_body_copy: bodyCopy,
    cta_text: template.cta_variants[0],
    cta_variants: template.cta_variants,

    visual_guidance: visualGuidance,

    created_at: new Date(),
    version: 1,
    approved: false,
    compliance_checked: false,
  };
}

/**
 * Get micro-segment specific customizations
 */
function getMicroSegmentCustomizations(
  microSegment: MicroSegment,
  template: SegmentCreativeTemplate
): {
  subjectLines: string[];
  headlines: string[];
  bodyCopy: string;
  positioning: string;
} {
  // Default to template values
  let subjectLines = [...template.subject_line_templates];
  let headlines = [...template.headline_templates];
  let bodyCopy = template.body_copy_template;
  let positioning = template.positioning_angles[0];

  // Customize based on micro-segment dimension
  const dimension = microSegment.rules[0]?.dimension;

  switch (dimension) {
    case 'discount_behavior':
      if (microSegment.name.toLowerCase().includes('full-price') ||
          microSegment.name.toLowerCase().includes('no discount')) {
        subjectLines = subjectLines.map((s) => s.replace(/sale|discount|save/gi, 'exclusive'));
        bodyCopy = bodyCopy.replace(/deal|discount|save/gi, 'exclusive access');
      }
      break;

    case 'category_affinity':
      // Add category-specific language
      if (microSegment.name.toLowerCase().includes('premium')) {
        positioning = 'Curated for your refined taste';
        headlines = ['For the Connoisseur', 'Premium Picks', 'Exceptional Quality'];
      }
      break;

    case 'geography':
      // Add regional customization hints
      positioning = 'Selected just for you in your region';
      break;

    case 'engagement':
      if (microSegment.name.toLowerCase().includes('heavy clicker') ||
          microSegment.name.toLowerCase().includes('engaged')) {
        positioning = 'We know you\'re interested - here\'s the perfect next step';
        headlines = ['The Next Step', 'Ready When You Are', 'Let\'s Make It Happen'];
      }
      break;

    case 'value_tier':
      if (microSegment.name.toLowerCase().includes('high value') ||
          microSegment.name.toLowerCase().includes('high aov')) {
        positioning = 'Premium selections for discerning customers';
        bodyCopy = 'Your appreciation for quality hasn\'t gone unnoticed. Here\'s a selection curated for your exceptional taste.';
      }
      break;
  }

  return { subjectLines, headlines, bodyCopy, positioning };
}

/**
 * Generate creative briefs for all segments
 */
export function generateAllBriefs(
  segmentStats: SegmentStats[],
  microSegmentsMap: Map<SegmentTag, MicroSegment[]>
): CreativeBrief[] {
  const briefs: CreativeBrief[] = [];

  for (const stats of segmentStats) {
    // Generate base segment brief
    const baseBrief = generateCreativeBrief(stats.tag, stats);
    briefs.push(baseBrief);

    // Generate briefs for viable micro-segments
    const microSegments = microSegmentsMap.get(stats.tag) || [];
    for (const microSegment of microSegments) {
      if (microSegment.creative_viable) {
        const microBrief = generateCreativeBrief(stats.tag, stats, microSegment);
        briefs.push(microBrief);
      }
    }
  }

  return briefs;
}

/**
 * Format a creative brief as JSON (for output)
 */
export function formatBriefAsJson(brief: CreativeBrief): string {
  return JSON.stringify(brief, null, 2);
}

/**
 * Export briefs to a structured format
 */
export function exportBriefs(briefs: CreativeBrief[]): {
  total_briefs: number;
  by_segment: Record<SegmentTag, CreativeBrief[]>;
  micro_segment_briefs: CreativeBrief[];
  base_segment_briefs: CreativeBrief[];
} {
  const bySegment: Record<SegmentTag, CreativeBrief[]> = {} as Record<SegmentTag, CreativeBrief[]>;

  for (const brief of briefs) {
    if (!bySegment[brief.segment_tag]) {
      bySegment[brief.segment_tag] = [];
    }
    bySegment[brief.segment_tag].push(brief);
  }

  return {
    total_briefs: briefs.length,
    by_segment: bySegment,
    micro_segment_briefs: briefs.filter((b) => b.micro_segment_id),
    base_segment_briefs: briefs.filter((b) => !b.micro_segment_id),
  };
}
