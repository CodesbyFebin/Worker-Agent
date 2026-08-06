/**
 * Layer 3 — Sanity Shield
 * Compliance, safety, and anti-detection layer.
 *
 * Every piece of content MUST pass through this layer before upload.
 *
 * Responsibilities:
 *  - Demonetization keyword scanning + auto-rewrite
 *  - AI-detection humanization (Human Noise Injection)
 *  - Copyright risk assessment
 *  - YouTube policy compliance check
 *  - Content uniqueness fingerprinting (prevents "repetitive content" flags)
 *  - Ad-friendliness scoring
 *  - Age restriction risk detection
 */

export { DemonetizationFilter } from './demonetization-filter.js';
export { HumanNoiseInjector } from './human-noise-injector.js';
export { CopyrightScanner } from './copyright-scanner.js';
export { PolicyGuard } from './policy-guard.js';
export { UniquenessChecker } from './uniqueness-checker.js';

/**
 * Run a full Sanity Shield validation on a content package.
 * Returns a validated + sanitized package, or throws if content is unsafe.
 */
export async function runSanityShield(contentPackage, niche) {
  const { DemonetizationFilter } = await import('./demonetization-filter.js');
  const { HumanNoiseInjector } = await import('./human-noise-injector.js');
  const { CopyrightScanner } = await import('./copyright-scanner.js');
  const { PolicyGuard } = await import('./policy-guard.js');
  const { UniquenessChecker } = await import('./uniqueness-checker.js');

  const results = {
    passed: true,
    warnings: [],
    modifications: [],
    scores: {}
  };

  // 1. Demonetization filter — scan + auto-rewrite flagged terms
  const demoResult = await DemonetizationFilter.scan(contentPackage.script, niche);
  if (demoResult.flaggedCount > 0) {
    contentPackage.script = demoResult.sanitizedScript;
    results.modifications.push(`Rewrote ${demoResult.flaggedCount} demonetization risk terms`);
  }
  results.scores.adFriendliness = demoResult.adFriendlinessScore;

  // 2. Human noise injection — defeat AI detection
  const humanizedScript = await HumanNoiseInjector.inject(contentPackage.script, niche);
  contentPackage.script = humanizedScript;
  results.modifications.push(`Applied human noise: ${humanizedScript.noiseInjectionLevel} level`);
  results.scores.humanScore = humanizedScript.humanScore;

  // 3. Copyright scan
  const copyrightResult = await CopyrightScanner.scan(contentPackage);
  if (copyrightResult.riskLevel === 'high') {
    results.passed = false;
    results.warnings.push(`HIGH copyright risk: ${copyrightResult.flags.join(', ')}`);
  } else if (copyrightResult.riskLevel === 'medium') {
    results.warnings.push(`Medium copyright risk: ${copyrightResult.flags.join(', ')}`);
  }
  results.scores.copyrightRisk = copyrightResult.riskScore;

  // 4. Policy guard — YouTube ToS compliance
  const policyResult = await PolicyGuard.check(contentPackage, niche);
  if (!policyResult.compliant) {
    results.passed = false;
    results.warnings.push(...policyResult.violations);
  }
  results.scores.policyCompliance = policyResult.complianceScore;

  // 5. Uniqueness check — prevent "repetitive content" algorithmic flag
  const uniquenessResult = await UniquenessChecker.check(contentPackage.script, niche);
  if (uniquenessResult.isDuplicate) {
    results.passed = false;
    results.warnings.push(`Duplicate content detected: ${(uniquenessResult.similarity * 100).toFixed(0)}% similar to ${uniquenessResult.matchedId}`);
  }
  results.scores.uniqueness = uniquenessResult.uniquenessScore;

  // Overall shield score
  results.overallScore = (
    results.scores.adFriendliness * 0.35 +
    results.scores.humanScore * 0.25 +
    (1 - results.scores.copyrightRisk) * 0.20 +
    results.scores.policyCompliance * 0.10 +
    results.scores.uniqueness * 0.10
  );

  return { ...contentPackage, shieldResults: results };
}
