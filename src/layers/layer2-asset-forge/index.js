/**
 * Layer 2 — Asset Forge
 * Transforms content opportunities into fully produced video assets.
 *
 * Responsibilities:
 *  - Script generation with Dynamic Script Architecture (DSA)
 *  - Retention hook injection every 7 seconds
 *  - Emotion-adaptive TTS via ElevenLabs
 *  - Semantic B-Roll matching (script verbs → visual assets)
 *  - Thumbnail generation with competitor heatmap scoring
 *  - SEO metadata package (3 title variants, 2 descriptions)
 *  - Pillar / Snippet / Short content splitting (Traffic Tornado)
 */

export { ScriptGenerator } from './script-generator.js';
export { TTSAdapter } from './tts-adapter.js';
export { BRollMatcher } from './broll-matcher.js';
export { ThumbnailEngine } from './thumbnail-engine.js';
export { MetadataPackager } from './metadata-packager.js';
export { ContentSplitter } from './content-splitter.js';

/**
 * Run a full Asset Forge cycle for a content opportunity
 * Returns a complete content package ready for Layer 3 validation
 */
export async function runAssetForgeCycle(opportunity, niche, competitorAnalysis = null) {
  const { ScriptGenerator } = await import('./script-generator.js');
  const { TTSAdapter } = await import('./tts-adapter.js');
  const { BRollMatcher } = await import('./broll-matcher.js');
  const { ThumbnailEngine } = await import('./thumbnail-engine.js');
  const { MetadataPackager } = await import('./metadata-packager.js');
  const { ContentSplitter } = await import('./content-splitter.js');

  // 1. Generate full script with DSA hooks
  const script = await ScriptGenerator.generate(opportunity, niche, competitorAnalysis);

  // 2. Split into Pillar / Snippet / Short versions
  const contentVersions = await ContentSplitter.split(script, niche);

  // 3. Generate TTS audio for each version
  const audioAssets = await TTSAdapter.generateAll(contentVersions, niche);

  // 4. Match B-Roll to script segments
  const brollPlan = await BRollMatcher.createPlan(script, niche);

  // 5. Generate thumbnail(s)
  const thumbnails = await ThumbnailEngine.generate(opportunity, niche, competitorAnalysis);

  // 6. Package all SEO metadata
  const metadata = await MetadataPackager.package(opportunity, script, niche);

  return {
    script,
    contentVersions,
    audioAssets,
    brollPlan,
    thumbnails,
    metadata,
    generatedAt: new Date().toISOString(),
    keyword: opportunity.keyword,
    nicheId: niche.id
  };
}
