/**
 * Brand Guardrails Validator
 * Validates creative briefs against brand rules and compliance requirements
 */

import type {
  CreativeBrief,
  BrandGuardrails,
  ComplianceCheckResult,
  ComplianceViolation,
  ComplianceRule,
} from '../types/creative';
import { v4 as uuidv4 } from '../engine/utils';

/**
 * Default brand guardrails (can be overridden per brand)
 */
export const DEFAULT_GUARDRAILS: BrandGuardrails = {
  brand_name: 'Default Brand',
  brand_voice: {
    personality: ['friendly', 'professional', 'helpful'],
    tone: ['conversational', 'approachable', 'confident'],
    language_style: 'conversational',
    sentence_style: 'medium',
    use_contractions: true,
    use_emoji: false,
    max_exclamation_marks: 2,
  },

  banned_words: [
    'cheap',
    'best ever',
    'guaranteed',
    'limited time only',
    'act now',
    'don\'t miss out',
    'once in a lifetime',
    'miracle',
    'revolutionary',
    'breakthrough',
    'free money',
    'no risk',
    'urgent',
    'winner',
    'congratulations',
    'selected',
    'click here',
    'click below',
    'unsubscribe',
  ],

  banned_phrases: [
    'buy now or regret forever',
    'this is not a drill',
    'you won\'t believe',
    'scientists hate',
    'doctors don\'t want you to know',
    'one weird trick',
    'make money fast',
    'act immediately',
    'last chance ever',
    'going out of business',
  ],

  competitor_mentions: [],

  required_disclaimer: undefined,
  legal_footer: undefined,

  avoid_tones: ['aggressive', 'desperate', 'manipulative', 'condescending'],
  preferred_tones: ['helpful', 'friendly', 'confident', 'genuine'],

  brand_colors: {
    primary: [],
    secondary: [],
    accent: [],
    forbidden: [],
  },

  compliance_rules: [
    {
      rule_id: 'no_all_caps',
      category: 'brand',
      description: 'Avoid using all caps for more than 2 consecutive words',
      check_type: 'pattern',
      pattern: '\\b[A-Z]{4,}\\s+[A-Z]{4,}\\s+[A-Z]{4,}\\b',
      severity: 'warning',
    },
    {
      rule_id: 'no_excessive_punctuation',
      category: 'brand',
      description: 'Avoid excessive punctuation (more than 3 in a row)',
      check_type: 'pattern',
      pattern: '[!?]{3,}',
      severity: 'error',
    },
    {
      rule_id: 'no_spam_triggers',
      category: 'legal',
      description: 'Avoid common spam trigger words',
      check_type: 'banned_word',
      severity: 'error',
    },
    {
      rule_id: 'appropriate_length_subject',
      category: 'brand',
      description: 'Subject lines should be under 60 characters',
      check_type: 'custom',
      severity: 'warning',
    },
    {
      rule_id: 'appropriate_length_headline',
      category: 'brand',
      description: 'Headlines should be under 80 characters',
      check_type: 'custom',
      severity: 'warning',
    },
  ],
};

/**
 * Validate a creative brief against brand guardrails
 */
export function validateBrief(
  brief: CreativeBrief,
  guardrails: BrandGuardrails = DEFAULT_GUARDRAILS
): ComplianceCheckResult {
  const violations: ComplianceViolation[] = [];
  const warnings: ComplianceViolation[] = [];

  // Check subject lines
  for (const subjectLine of brief.subject_lines) {
    const subjectViolations = checkText(subjectLine, 'subject_line', guardrails);
    categorizeViolations(subjectViolations, violations, warnings);

    // Check length
    if (subjectLine.length > 60) {
      warnings.push({
        rule_id: 'appropriate_length_subject',
        field: 'subject_line',
        original_value: subjectLine,
        violation_type: 'length',
        severity: 'warning',
        suggested_fix: subjectLine.slice(0, 57) + '...',
        auto_fixable: true,
      });
    }
  }

  // Check headlines
  for (const headline of brief.hero_headlines) {
    const headlineViolations = checkText(headline, 'hero_headline', guardrails);
    categorizeViolations(headlineViolations, violations, warnings);

    // Check length
    if (headline.length > 80) {
      warnings.push({
        rule_id: 'appropriate_length_headline',
        field: 'hero_headline',
        original_value: headline,
        violation_type: 'length',
        severity: 'warning',
        suggested_fix: headline.slice(0, 77) + '...',
        auto_fixable: true,
      });
    }
  }

  // Check body copy
  const bodyViolations = checkText(brief.supporting_body_copy, 'supporting_body_copy', guardrails);
  categorizeViolations(bodyViolations, violations, warnings);

  // Check CTA text
  for (const cta of brief.cta_variants) {
    const ctaViolations = checkText(cta, 'cta_text', guardrails);
    categorizeViolations(ctaViolations, violations, warnings);
  }

  // Check positioning statement
  const positioningViolations = checkText(brief.positioning_statement, 'positioning_statement', guardrails);
  categorizeViolations(positioningViolations, violations, warnings);

  // Check value proposition
  const valuePropViolations = checkText(brief.value_proposition, 'value_proposition', guardrails);
  categorizeViolations(valuePropViolations, violations, warnings);

  // Check brand voice compliance
  const voiceViolations = checkBrandVoice(brief, guardrails);
  categorizeViolations(voiceViolations, violations, warnings);

  const isCompliant = violations.length === 0;

  // Auto-fix if possible
  let fixedBrief: CreativeBrief | undefined;
  const autoFixableViolations = [...violations, ...warnings].filter((v) => v.auto_fixable);

  if (autoFixableViolations.length > 0) {
    fixedBrief = autoFixBrief(brief, autoFixableViolations, guardrails);
  }

  return {
    brief_id: brief.brief_id,
    is_compliant: isCompliant,
    violations,
    warnings,
    checked_at: new Date(),
    auto_fixed: fixedBrief !== undefined,
    fixed_brief: fixedBrief,
  };
}

/**
 * Check text against guardrails
 */
function checkText(
  text: string,
  field: string,
  guardrails: BrandGuardrails
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const lowerText = text.toLowerCase();

  // Check banned words
  for (const word of guardrails.banned_words) {
    if (lowerText.includes(word.toLowerCase())) {
      violations.push({
        rule_id: 'no_spam_triggers',
        field,
        original_value: text,
        violation_type: 'banned_word',
        severity: 'error',
        suggested_fix: text.replace(new RegExp(word, 'gi'), '***'),
        auto_fixable: true,
      });
    }
  }

  // Check banned phrases
  for (const phrase of guardrails.banned_phrases) {
    if (lowerText.includes(phrase.toLowerCase())) {
      violations.push({
        rule_id: 'no_spam_triggers',
        field,
        original_value: text,
        violation_type: 'banned_phrase',
        severity: 'error',
        suggested_fix: text.replace(new RegExp(phrase, 'gi'), ''),
        auto_fixable: true,
      });
    }
  }

  // Check competitor mentions
  for (const competitor of guardrails.competitor_mentions) {
    if (lowerText.includes(competitor.toLowerCase())) {
      violations.push({
        rule_id: 'competitor_mention',
        field,
        original_value: text,
        violation_type: 'competitor',
        severity: 'error',
        suggested_fix: text.replace(new RegExp(competitor, 'gi'), '[brand]'),
        auto_fixable: false,
      });
    }
  }

  // Check pattern-based rules
  for (const rule of guardrails.compliance_rules) {
    if (rule.check_type === 'pattern' && rule.pattern) {
      const regex = new RegExp(rule.pattern, 'g');
      if (regex.test(text)) {
        violations.push({
          rule_id: rule.rule_id,
          field,
          original_value: text,
          violation_type: 'pattern',
          severity: rule.severity,
          auto_fixable: false,
        });
      }
    }
  }

  // Check exclamation marks
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > guardrails.brand_voice.max_exclamation_marks) {
    violations.push({
      rule_id: 'excessive_exclamation',
      field,
      original_value: text,
      violation_type: 'punctuation',
      severity: 'warning',
      suggested_fix: text.replace(/!+/g, '!').replace(/!([^!]*!)/, '$1'),
      auto_fixable: true,
    });
  }

  return violations;
}

/**
 * Check brand voice compliance
 */
function checkBrandVoice(
  brief: CreativeBrief,
  guardrails: BrandGuardrails
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  // Check for avoided tones (basic heuristic check)
  const aggressivePatterns = [
    /act now/i,
    /don't wait/i,
    /hurry/i,
    /last chance/i,
    /final warning/i,
    /you must/i,
  ];

  const desperatePatterns = [
    /please/i,
    /begging/i,
    /we need you/i,
    /help us/i,
  ];

  const allText = [
    ...brief.subject_lines,
    ...brief.hero_headlines,
    brief.supporting_body_copy,
    brief.positioning_statement,
  ].join(' ');

  if (guardrails.avoid_tones.includes('aggressive')) {
    for (const pattern of aggressivePatterns) {
      if (pattern.test(allText)) {
        violations.push({
          rule_id: 'aggressive_tone',
          field: 'overall',
          original_value: allText.match(pattern)?.[0] || '',
          violation_type: 'tone',
          severity: 'warning',
          auto_fixable: false,
        });
        break;
      }
    }
  }

  if (guardrails.avoid_tones.includes('desperate')) {
    for (const pattern of desperatePatterns) {
      if (pattern.test(allText)) {
        violations.push({
          rule_id: 'desperate_tone',
          field: 'overall',
          original_value: allText.match(pattern)?.[0] || '',
          violation_type: 'tone',
          severity: 'warning',
          auto_fixable: false,
        });
        break;
      }
    }
  }

  // Check emoji usage
  const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/u.test(allText);
  if (hasEmoji && !guardrails.brand_voice.use_emoji) {
    violations.push({
      rule_id: 'no_emoji',
      field: 'overall',
      original_value: 'Contains emoji',
      violation_type: 'style',
      severity: 'warning',
      auto_fixable: true,
    });
  }

  return violations;
}

/**
 * Categorize violations by severity
 */
function categorizeViolations(
  allViolations: ComplianceViolation[],
  errors: ComplianceViolation[],
  warnings: ComplianceViolation[]
): void {
  for (const violation of allViolations) {
    if (violation.severity === 'error') {
      errors.push(violation);
    } else {
      warnings.push(violation);
    }
  }
}

/**
 * Auto-fix violations in a brief
 */
function autoFixBrief(
  brief: CreativeBrief,
  violations: ComplianceViolation[],
  guardrails: BrandGuardrails
): CreativeBrief {
  const fixedBrief = { ...brief };

  // Create a map of field to fixes
  const fixesByField = new Map<string, string>();

  for (const violation of violations) {
    if (violation.auto_fixable && violation.suggested_fix) {
      // For subject lines and headlines, we need to handle arrays
      if (violation.field === 'subject_line') {
        fixedBrief.subject_lines = fixedBrief.subject_lines.map((line) =>
          line === violation.original_value ? violation.suggested_fix! : line
        );
      } else if (violation.field === 'hero_headline') {
        fixedBrief.hero_headlines = fixedBrief.hero_headlines.map((line) =>
          line === violation.original_value ? violation.suggested_fix! : line
        );
      } else if (violation.field === 'cta_text') {
        fixedBrief.cta_variants = fixedBrief.cta_variants.map((cta) =>
          cta === violation.original_value ? violation.suggested_fix! : cta
        );
        if (fixedBrief.cta_text === violation.original_value) {
          fixedBrief.cta_text = violation.suggested_fix!;
        }
      } else if (violation.field === 'supporting_body_copy') {
        fixedBrief.supporting_body_copy = violation.suggested_fix!;
      } else if (violation.field === 'positioning_statement') {
        fixedBrief.positioning_statement = violation.suggested_fix!;
      } else if (violation.field === 'value_proposition') {
        fixedBrief.value_proposition = violation.suggested_fix!;
      }
    }
  }

  // Remove emojis if not allowed
  if (!guardrails.brand_voice.use_emoji) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/gu;
    fixedBrief.subject_lines = fixedBrief.subject_lines.map((line) => line.replace(emojiRegex, '').trim());
    fixedBrief.hero_headlines = fixedBrief.hero_headlines.map((line) => line.replace(emojiRegex, '').trim());
    fixedBrief.supporting_body_copy = fixedBrief.supporting_body_copy.replace(emojiRegex, '').trim();
    fixedBrief.cta_text = fixedBrief.cta_text.replace(emojiRegex, '').trim();
    fixedBrief.cta_variants = fixedBrief.cta_variants.map((cta) => cta.replace(emojiRegex, '').trim());
  }

  fixedBrief.compliance_checked = true;
  fixedBrief.version = brief.version + 1;

  return fixedBrief;
}

/**
 * Validate all briefs in a batch
 */
export function validateBriefs(
  briefs: CreativeBrief[],
  guardrails: BrandGuardrails = DEFAULT_GUARDRAILS
): ComplianceCheckResult[] {
  return briefs.map((brief) => validateBrief(brief, guardrails));
}

/**
 * Get compliant briefs only
 */
export function getCompliantBriefs(
  briefs: CreativeBrief[],
  results: ComplianceCheckResult[]
): CreativeBrief[] {
  const compliantIds = new Set(results.filter((r) => r.is_compliant).map((r) => r.brief_id));
  return briefs.filter((b) => compliantIds.has(b.brief_id));
}

/**
 * Get fixed briefs where auto-fix was applied
 */
export function getFixedBriefs(
  results: ComplianceCheckResult[]
): CreativeBrief[] {
  return results
    .filter((r) => r.auto_fixed && r.fixed_brief)
    .map((r) => r.fixed_brief!);
}

/**
 * Generate compliance report
 */
export function generateComplianceReport(
  results: ComplianceCheckResult[]
): {
  total_checked: number;
  compliant: number;
  non_compliant: number;
  auto_fixed: number;
  violations_by_type: Record<string, number>;
  most_common_violations: { rule_id: string; count: number }[];
} {
  const violationCounts: Record<string, number> = {};

  for (const result of results) {
    for (const violation of [...result.violations, ...result.warnings]) {
      violationCounts[violation.rule_id] = (violationCounts[violation.rule_id] || 0) + 1;
    }
  }

  const sortedViolations = Object.entries(violationCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([rule_id, count]) => ({ rule_id, count }));

  return {
    total_checked: results.length,
    compliant: results.filter((r) => r.is_compliant).length,
    non_compliant: results.filter((r) => !r.is_compliant).length,
    auto_fixed: results.filter((r) => r.auto_fixed).length,
    violations_by_type: violationCounts,
    most_common_violations: sortedViolations.slice(0, 10),
  };
}

/**
 * Create custom guardrails for a brand
 */
export function createCustomGuardrails(
  brandName: string,
  overrides: Partial<BrandGuardrails>
): BrandGuardrails {
  return {
    ...DEFAULT_GUARDRAILS,
    ...overrides,
    brand_name: brandName,
    brand_voice: {
      ...DEFAULT_GUARDRAILS.brand_voice,
      ...overrides.brand_voice,
    },
    brand_colors: {
      ...DEFAULT_GUARDRAILS.brand_colors,
      ...overrides.brand_colors,
    },
    banned_words: [
      ...DEFAULT_GUARDRAILS.banned_words,
      ...(overrides.banned_words || []),
    ],
    banned_phrases: [
      ...DEFAULT_GUARDRAILS.banned_phrases,
      ...(overrides.banned_phrases || []),
    ],
    compliance_rules: [
      ...DEFAULT_GUARDRAILS.compliance_rules,
      ...(overrides.compliance_rules || []),
    ],
  };
}
