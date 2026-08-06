/**
 * Copyright Scanner
 *
 * Assesses copyright risk across all content package components:
 *  - Script text (quotes, lyrics, brand names, trademarked phrases)
 *  - B-Roll assets (license verification)
 *  - Music (ContentID risk)
 *  - Titles (trademark conflicts)
 *
 * Risk levels: low | medium | high
 * High = block upload, Medium = add warning, Low = proceed
 */

import logger from '../../utils/logger.js';

const log = logger.layer('CopyrightScanner');

// Known trademark and brand name patterns to flag
const TRADEMARK_PATTERNS = [
  /\bPhotoshop\b/gi, /\bGoogle\b/gi, /\bApple\b/gi, /\bFacebook\b/gi,
  /\bInstagram\b/gi, /\bTikTok\b/gi, /\bSnapchat\b/gi, /\bTwitter\b(?!\s+alternative)/gi,
  /\bMicrosoft\b/gi, /\bNike\b/gi, /\bAdidas\b/gi, /\bCoca-Cola\b/gi,
  /\bMcDonald's\b/gi, /\bAmazon\b(?!\s+rainforest)/gi, /\bNetflix\b/gi,
  /\bDisney\b/gi, /\bMarvel\b/gi, /\bDC Comics\b/gi, /\bHarry Potter\b/gi,
  /\bStar Wars\b/gi, /\bMinecraft\b/gi, /\bFortnite\b/gi
];

// Common song lyric fragments that trigger ContentID
const LYRIC_PATTERNS = [
  /never gonna give you up/gi, /all you need is love/gi,
  /we will rock you/gi, /bohemian rhapsody/gi,
  /i will survive/gi, /don't stop believin/gi,
  /eye of the tiger/gi, /livin on a prayer/gi,
  /sweet child o mine/gi, /another one bites the dust/gi
];

// License types and their risk levels
const LICENSE_RISK_MAP = {
  'cc0': 'low',
  'public_domain': 'low',
  'cc_by': 'low',
  'cc_by_sa': 'low',
  'cc_by_nd': 'medium',
  'cc_by_nc': 'medium',
  'pexels': 'low',
  'pixabay': 'low',
  'unsplash': 'low',
  'shutterstock': 'low',   // Paid license
  'getty': 'low',          // Paid license
  'youtube_cc': 'low',
  'mock': 'low',           // Dev placeholders
  'unknown': 'medium',
  'proprietary': 'high',
  'all_rights_reserved': 'high'
};

export class CopyrightScanner {

  /**
   * Full copyright scan of a content package
   */
  static async scan(contentPackage) {
    log.info(`Running copyright scan on content package`);

    const flags = [];
    let riskScore = 0;

    // 1. Script text scan
    const scriptRisk = CopyrightScanner.scanScriptText(contentPackage.script);
    flags.push(...scriptRisk.flags);
    riskScore += scriptRisk.riskContribution;

    // 2. B-Roll asset license verification
    const brollRisk = CopyrightScanner.scanBRollLicenses(contentPackage.brollPlan);
    flags.push(...brollRisk.flags);
    riskScore += brollRisk.riskContribution;

    // 3. Metadata scan (titles can have trademark issues)
    if (contentPackage.metadata) {
      const metaRisk = CopyrightScanner.scanMetadata(contentPackage.metadata);
      flags.push(...metaRisk.flags);
      riskScore += metaRisk.riskContribution;
    }

    const riskLevel = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'medium' : 'low';

    log.info(`Copyright scan complete: ${riskLevel} risk (score: ${riskScore.toFixed(2)}, ${flags.length} flags)`);

    return {
      riskLevel,
      riskScore: Math.min(riskScore, 1.0),
      flags,
      recommendations: CopyrightScanner.buildRecommendations(flags, riskLevel)
    };
  }

  /**
   * Scan script text for trademark mentions and lyric fragments
   */
  static scanScriptText(script) {
    if (!script) return { flags: [], riskContribution: 0 };

    const fullText = script.segments?.map((s) => s.text).join(' ') || '';
    const flags = [];
    let risk = 0;

    // Check trademark patterns
    for (const pattern of TRADEMARK_PATTERNS) {
      const matches = fullText.match(pattern);
      if (matches) {
        flags.push(`Trademark mention: "${matches[0]}" (review context)`);
        risk += 0.05; // Low contribution — brand mentions are usually okay in commentary
      }
    }

    // Check lyric fragments (ContentID high risk)
    for (const pattern of LYRIC_PATTERNS) {
      if (pattern.test(fullText)) {
        flags.push(`Potential lyric fragment detected — review and remove`);
        risk += 0.3;
      }
    }

    // Check for direct quote patterns (extended quotes = risk)
    const quoteMatches = fullText.match(/"[^"]{50,}"/g) || [];
    if (quoteMatches.length > 2) {
      flags.push(`${quoteMatches.length} extended direct quotes — verify fair use`);
      risk += quoteMatches.length * 0.05;
    }

    return { flags, riskContribution: Math.min(risk, 0.5) };
  }

  /**
   * Verify B-Roll asset licenses
   */
  static scanBRollLicenses(brollPlan) {
    if (!brollPlan || !brollPlan.length) return { flags: [], riskContribution: 0 };

    const flags = [];
    let risk = 0;

    for (const item of brollPlan) {
      const asset = item.asset;
      if (!asset) continue;

      const assetType = asset.type || 'unknown';
      const licenseRisk = LICENSE_RISK_MAP[assetType] || LICENSE_RISK_MAP.unknown;

      if (licenseRisk === 'high') {
        flags.push(`High-risk asset license: ${asset.query} (${assetType})`);
        risk += 0.2;
      } else if (licenseRisk === 'medium') {
        flags.push(`Verify license for: ${asset.query}`);
        risk += 0.05;
      }

      // Check attribution requirements
      if (asset.attribution && assetType.startsWith('cc_by')) {
        flags.push(`Attribution required: ${asset.attribution}`);
        // Not a risk, but must be in description
      }
    }

    return { flags, riskContribution: Math.min(risk, 0.4) };
  }

  /**
   * Scan metadata titles for trademark conflicts
   */
  static scanMetadata(metadata) {
    const flags = [];
    let risk = 0;

    const titlesText = [
      metadata.primaryTitle,
      ...(metadata.titles?.map((t) => t.title) || [])
    ].join(' ');

    for (const pattern of TRADEMARK_PATTERNS) {
      if (pattern.test(titlesText)) {
        const match = titlesText.match(pattern);
        flags.push(`Trademark in title: "${match?.[0]}" — ensure commentary/review framing`);
        risk += 0.1;
      }
    }

    return { flags, riskContribution: Math.min(risk, 0.3) };
  }

  /**
   * Build actionable recommendations based on flags
   */
  static buildRecommendations(flags, riskLevel) {
    const recs = [];

    if (riskLevel === 'high') {
      recs.push('CRITICAL: Review all high-risk flags before upload');
      recs.push('Consider postponing this video until copyright issues are resolved');
    }

    if (flags.some((f) => f.includes('Trademark'))) {
      recs.push('Add "not affiliated with" disclaimer in description for mentioned brands');
      recs.push('Frame brand mentions as commentary/review for Fair Use protection');
    }

    if (flags.some((f) => f.includes('lyric'))) {
      recs.push('Remove all song lyric fragments — use paraphrase instead');
      recs.push('Use royalty-free music from YouTube Audio Library');
    }

    if (flags.some((f) => f.includes('Attribution'))) {
      recs.push('Add asset attributions to video description');
    }

    if (recs.length === 0) {
      recs.push('Content appears clean — proceed with standard review');
    }

    return recs;
  }
}
