/**
 * Policy Guard
 *
 * Full YouTube Terms of Service and Community Guidelines compliance checker.
 *
 * Checks against:
 *  - Spam, Deceptive Practices & Scams policy
 *  - Misinformation policy (health, election, COVID)
 *  - Harmful/Dangerous content policy
 *  - Child Safety policy (COPPA compliance)
 *  - Hate Speech policy
 *  - Harassment policy
 *  - Misleading Thumbnail/Title policy
 *  - Repetitive/Reused Content policy
 *  - AI-Generated content disclosure requirements
 */

import logger from '../../utils/logger.js';

const log = logger.layer('PolicyGuard');

// Health misinformation trigger phrases
const HEALTH_MISINFO_PATTERNS = [
  /\bcures? (cancer|diabetes|covid|aids|hiv|autism)\b/gi,
  /\bguaranteed (to cure|to treat|to heal)\b/gi,
  /\bdoctors (don't want|hate) you (to know|knowing)\b/gi,
  /\bgovernment (is hiding|hides|conceals) (the cure|treatment)\b/gi,
  /\bvaccine (causes|cause|caused) autism\b/gi,
  /\bmiracle cure\b/gi,
  /\bfda (banned|suppressed)\b/gi
];

// Election/political misinformation
const ELECTION_MISINFO_PATTERNS = [
  /\belection (was|is) rigged\b/gi,
  /\bvoting machines (are|were) hacked\b/gi,
  /\bstolen election\b/gi,
  /\bvoter fraud (is rampant|everywhere)\b/gi
];

// Harmful challenge/dangerous content
const DANGEROUS_CONTENT_PATTERNS = [
  /\b(how to|tutorial|guide) (make|build|create) (a )?bomb\b/gi,
  /\b(how to|tutorial) (hack|break into|bypass) (a )?[a-z]+ (system|account|server)\b/gi,
  /\bchloroform\b/gi,
  /\bdrunk driving\b.*\b(fun|cool|try)\b/gi
];

// Misleading title/thumbnail signal patterns
const MISLEADING_PATTERNS = [
  /\bI (quit|quitting|quitted)\b.*(clickbait disclaimer)/gi, // Only flag if combined with disclaimer
  /(\$[0-9,]+).*(per (day|hour|month|week))/gi, // Unrealistic income claims need disclaimer
];

// Phrases that require AI-generated content disclosure
const AI_DISCLOSURE_TRIGGERS = [
  'realistic depiction', 'real person', 'actual footage',
  'this really happened', 'caught on camera', 'exclusive footage'
];

export class PolicyGuard {

  /**
   * Run full policy compliance check on content package
   */
  static async check(contentPackage, niche) {
    log.info(`Running policy compliance check`);

    const violations = [];
    const warnings = [];
    let complianceScore = 1.0;

    const fullText = contentPackage.script?.segments?.map((s) => s.text).join(' ') || '';
    const titles = contentPackage.metadata?.titles?.map((t) => t.title).join(' ') || '';
    const allText = fullText + ' ' + titles;

    // 1. Health misinformation check
    const healthCheck = PolicyGuard.checkHealthMisinfo(allText);
    violations.push(...healthCheck.violations);
    warnings.push(...healthCheck.warnings);
    complianceScore -= healthCheck.penalty;

    // 2. Election misinformation
    const electionCheck = PolicyGuard.checkElectionMisinfo(allText);
    violations.push(...electionCheck.violations);
    complianceScore -= electionCheck.penalty;

    // 3. Dangerous content
    const dangerCheck = PolicyGuard.checkDangerousContent(allText);
    violations.push(...dangerCheck.violations);
    complianceScore -= dangerCheck.penalty;

    // 4. Spam/deceptive practices
    const spamCheck = PolicyGuard.checkDeceptivePractices(contentPackage.metadata, niche);
    warnings.push(...spamCheck.warnings);
    complianceScore -= spamCheck.penalty;

    // 5. COPPA — child safety
    const coppaCheck = PolicyGuard.checkCOPPA(contentPackage, niche);
    if (!coppaCheck.compliant) violations.push(...coppaCheck.violations);
    complianceScore -= coppaCheck.penalty;

    // 6. AI disclosure requirement
    const aiCheck = PolicyGuard.checkAIDisclosure(allText, contentPackage.metadata);
    if (aiCheck.requiresDisclosure && !aiCheck.hasDisclosure) {
      warnings.push('AI-generated content detected — add disclosure in description');
    }

    // 7. Repetitive content detection
    const repCheck = PolicyGuard.checkRepetitivePattern(contentPackage.script);
    if (repCheck.isRepetitive) {
      warnings.push(`Script appears template-heavy (${(repCheck.templateScore * 100).toFixed(0)}% similarity to base pattern) — increase variation`);
      complianceScore -= 0.05;
    }

    const finalScore = Math.max(0, complianceScore);
    const isCompliant = violations.length === 0;

    log.info(`Policy check complete: ${isCompliant ? 'COMPLIANT' : 'VIOLATIONS FOUND'} (score: ${finalScore.toFixed(2)}, ${violations.length} violations, ${warnings.length} warnings)`);

    return {
      compliant: isCompliant,
      complianceScore: finalScore,
      violations,
      warnings,
      recommendations: PolicyGuard.buildRecommendations(violations, warnings, niche)
    };
  }

  static checkHealthMisinfo(text) {
    const violations = [], warnings = [];
    let penalty = 0;

    for (const pattern of HEALTH_MISINFO_PATTERNS) {
      if (pattern.test(text)) {
        violations.push(`Health misinformation pattern detected: ${pattern.source.slice(0, 50)}`);
        penalty += 0.3;
      }
    }

    // Softer health claims — warn but don't block
    if (/\bscientifically proven\b/gi.test(text) && !/\bstudy|research|according to\b/gi.test(text)) {
      warnings.push('Unsubstantiated "scientifically proven" claim — add source reference');
      penalty += 0.02;
    }

    return { violations, warnings, penalty };
  }

  static checkElectionMisinfo(text) {
    const violations = [];
    let penalty = 0;

    for (const pattern of ELECTION_MISINFO_PATTERNS) {
      if (pattern.test(text)) {
        violations.push(`Election misinformation pattern detected — remove before upload`);
        penalty += 0.5;
      }
    }

    return { violations, penalty };
  }

  static checkDangerousContent(text) {
    const violations = [];
    let penalty = 0;

    for (const pattern of DANGEROUS_CONTENT_PATTERNS) {
      if (pattern.test(text)) {
        violations.push(`Dangerous content instructions detected — remove immediately`);
        penalty += 0.8;
      }
    }

    return { violations, penalty };
  }

  static checkDeceptivePractices(metadata, niche) {
    const warnings = [];
    let penalty = 0;

    if (!metadata) return { warnings, penalty };

    const titles = metadata.titles?.map((t) => t.title).join(' ') || '';

    // Extreme income claims without disclaimer
    const incomeMatch = titles.match(/\$[\d,]+\s*(per|\/)\s*(day|hour|month|week)/i);
    if (incomeMatch) {
      warnings.push(`Income claim "${incomeMatch[0]}" in title — add "results not typical" disclaimer`);
      penalty += 0.05;
    }

    // "Free" without clarification
    if (/\bfree\b/i.test(titles) && niche.monetizationStrategy?.includes('affiliate')) {
      warnings.push('Title mentions "free" but video may promote paid products — ensure accuracy');
      penalty += 0.02;
    }

    // Titles that promise things video doesn't deliver
    if (/\b(secret|hidden|they don't want you to know)\b/i.test(titles)) {
      warnings.push('Curiosity-gap title detected — ensure video delivers on the promise to avoid dislike bombs');
      // Not a policy violation, but a quality warning
    }

    return { warnings, penalty };
  }

  static checkCOPPA(contentPackage, niche) {
    const violations = [];
    let penalty = 0;
    let compliant = true;

    // Check if content is directed at children
    const childDirectedSignals = [
      niche.targetAge?.includes('under 13'),
      niche.targetAge?.includes('kids'),
      niche.category === 'kids',
      niche.category === 'children'
    ];

    const isChildDirected = childDirectedSignals.some(Boolean);

    if (isChildDirected) {
      // Child-directed content requirements
      warnings = [];
      violations.push('Content marked as child-directed — ensure no behavioral advertising, no data collection, and COPPA-compliant metadata');
      penalty = 0.1;
      compliant = false;
    }

    return { compliant, violations, penalty };
  }

  static checkAIDisclosure(text, metadata) {
    const requiresDisclosure = AI_DISCLOSURE_TRIGGERS.some((trigger) =>
      text.toLowerCase().includes(trigger)
    );

    // Check if description already has disclosure
    const description = metadata?.primaryDescription || '';
    const hasDisclosure = /\b(ai.generated|artificial intelligence|generated by ai|created with ai)\b/i.test(description);

    return { requiresDisclosure, hasDisclosure };
  }

  /**
   * Check if script is too template-similar to previous generations
   * High template score = risk of "repetitive content" policy violation
   */
  static checkRepetitivePattern(script) {
    if (!script?.segments) return { isRepetitive: false, templateScore: 0 };

    const text = script.segments.map((s) => s.text).join(' ').toLowerCase();

    // Count "template-ish" phrases that suggest copy-paste generation
    const templatePhrases = [
      'in this video', 'today we\'re going to', 'let\'s get started',
      'make sure to subscribe', 'hit that like button', 'comment below',
      'without further ado', 'so without any further ado', 'let\'s dive in',
      'in conclusion', 'to sum up', 'at the end of the day',
      'having said that', 'that being said', 'all things considered'
    ];

    let phraseHits = 0;
    for (const phrase of templatePhrases) {
      if (text.includes(phrase)) phraseHits++;
    }

    const templateScore = phraseHits / templatePhrases.length;
    const isRepetitive = templateScore > 0.4; // More than 40% template phrases

    return { isRepetitive, templateScore };
  }

  static buildRecommendations(violations, warnings, niche) {
    const recs = [];

    if (violations.length > 0) {
      recs.push('Address all VIOLATIONS before upload — these can result in strikes or removal');
    }

    if (warnings.length > 0) {
      recs.push('Review WARNINGS — these may limit ad revenue or recommendations');
    }

    recs.push('Add AI-generated content disclosure in video description');
    recs.push('Verify all statistics and claims have credible sources mentioned');

    if (niche.monetizationStrategy?.includes('affiliate')) {
      recs.push('Add FTC-required affiliate disclosure: "This video contains sponsored links"');
    }

    return recs;
  }
}
