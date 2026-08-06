/**
 * Platform-Specific Caption Generator
 * Phase 13 — Social Syndication
 *
 * Generates platform-optimized captions from the video title and niche.
 * Each platform has different optimal hashtag counts, tone, and CTA style.
 *
 * Platform rules:
 *  Instagram: 20-30 hashtags, heavy emoji, "Follow for more" CTA, curiosity hooks
 *  Facebook:  8-12 hashtags, conversational, "Comment below" CTA, community feel
 *
 * Hashtag strategy:
 *  Tier 1 (3 tags):  Mega-broad (>10M posts) — for reach
 *  Tier 2 (10 tags): Mid-range (1M-10M posts) — for targeting
 *  Tier 3 (10 tags): Niche-specific (<1M posts) — for community engagement
 *  Tier 4 (5 tags):  Trending/seasonal — for algorithm boost
 */

import logger from '../../utils/logger.js';

const log = logger.layer('CaptionGenerator');

// ─── Niche Hashtag Libraries ────────────────────────────────────────────────

const HASHTAG_LIBRARY = {
  technology: {
    tier1: ['#tech', '#technology', '#innovation'],
    tier2: ['#ai', '#artificialintelligence', '#machinelearning', '#coding', '#programming',
            '#software', '#startup', '#gadgets', '#digitallife', '#techtips'],
    tier3: ['#aitools2026', '#techreview', '#productivityhacks', '#devlife', '#techcommunity',
            '#softwaredev', '#techenthusiast', '#futurism', '#techshorts', '#airevolution'],
    tier4: ['#viral', '#trending2026', '#reels', '#shortsvideo', '#foryou'],
    fbBonus: ['#TechNews', '#TechLovers', '#AIUpdates']
  },
  finance: {
    tier1: ['#money', '#finance', '#wealth'],
    tier2: ['#investing', '#personalfinance', '#passiveincome', '#financialfreedom',
            '#stockmarket', '#crypto', '#budgeting', '#savingmoney', '#richlife', '#sidehustle'],
    tier3: ['#wealthbuilding2026', '#financetips', '#moneymindsset', '#debtfree', '#firemethod',
            '#investingforbeginners', '#dividendstocks', '#indexfunds', '#financialintelligence', '#moneycoach'],
    tier4: ['#viral', '#trending', '#reels', '#foryoupage', '#explore'],
    fbBonus: ['#FinancialAdvice', '#MoneyTips', '#InvestingTips']
  },
  health: {
    tier1: ['#health', '#wellness', '#fitness'],
    tier2: ['#healthyliving', '#nutrition', '#workout', '#mindfulness', '#selfcare',
            '#gutHealth', '#biohacking', '#longevity', '#mentalhealth', '#healthtips'],
    tier3: ['#healthoptimization', '#longevitytips', '#sleepscience', '#antiaging2026',
            '#healthhacks', '#nutritionfacts', '#guthealth101', '#coldplunge', '#inflammation', '#vitality'],
    tier4: ['#viral', '#reels', '#trending', '#healthreels', '#wellnessjourney'],
    fbBonus: ['#HealthyLiving', '#WellnessWednesday', '#HealthTips']
  },
  gaming: {
    tier1: ['#gaming', '#gamer', '#videogames'],
    tier2: ['#gamingcommunity', '#gaminglife', '#pcgaming', '#consolegaming', '#esports',
            '#gamertok', '#gamingnews', '#gamereview', '#gameplay', '#twitch'],
    tier3: ['#gta5', '#gaming2026', '#gamingreels', '#gaminghighlights', '#gamingclips',
            '#openworld', '#rpggames', '#indiегaming', '#gamingmemes', '#nextgengaming'],
    tier4: ['#viral', '#trending', '#shorts', '#foryou', '#gamingshorts'],
    fbBonus: ['#GamingCommunity', '#GamerLife', '#VideoGames']
  },
  cooking: {
    tier1: ['#food', '#cooking', '#recipes'],
    tier2: ['#foodie', '#homecooking', '#mealprep', '#healthyfood', '#easyrecipes',
            '#delicious', '#foodphotography', '#yummy', '#dinner', '#foodlovers'],
    tier3: ['#mealprep2026', '#5ingredientmeals', '#quickdinnerideas', '#budgetmeals',
            '#cookingshorts', '#recipevideo', '#airfryerrecipes', '#veganrecipes', '#comfortfood', '#foodhacks'],
    tier4: ['#viral', '#trending', '#reels', '#foodreels', '#foryou'],
    fbBonus: ['#FoodLovers', '#CookingTips', '#RecipeShare']
  },
  'true-crime': {
    tier1: ['#truecrime', '#mystery', '#crime'],
    tier2: ['#crimestories', '#coldcase', '#unsolved', '#criminalminds', '#serialkiller',
            '#paranormal', '#darkstories', '#investigative', '#criminal', '#casefiles'],
    tier3: ['#truecrimetok', '#truecrimeshorts', '#coldcasefile', '#mysterysolved', '#crimecase',
            '#criminaljustice', '#detectivestory', '#unexplained', '#creepystories', '#darkweb'],
    tier4: ['#viral', '#trending', '#reels', '#foryou', '#scary'],
    fbBonus: ['#TrueCrimeCommunity', '#MysteryStories', '#CrimePodcast']
  },
  fitness: {
    tier1: ['#fitness', '#workout', '#gym'],
    tier2: ['#fitnessmotivation', '#bodybuilding', '#weightloss', '#musclebuilding', '#cardio',
            '#fitlife', '#gymlife', '#personaltrainer', '#fatloss', '#homeworkout'],
    tier3: ['#fitnessshorts', '#workoutroutine2026', '#callisthenic', '#natty', '#fitnesshacks',
            '#progresspics', '#gainz', '#gymrat', '#shredded', '#fitcoach'],
    tier4: ['#viral', '#trending', '#reels', '#fitreels', '#foryou'],
    fbBonus: ['#FitnessGoals', '#GymMotivation', '#WorkoutTips']
  },
  education: {
    tier1: ['#education', '#learning', '#knowledge'],
    tier2: ['#study', '#motivation', '#productivity', '#selfimprovement', '#mindset',
            '#learning', '#skills', '#personaldevelopment', '#success', '#growth'],
    tier3: ['#learnontok', '#educationalcontent', '#studytips2026', '#braintraining', '#howtolearn',
            '#selfhelp', '#lifelessons', '#wisdomquotes', '#knowledgeipower', '#growthmindset'],
    tier4: ['#viral', '#trending', '#reels', '#foryou', '#educationalreels'],
    fbBonus: ['#EducationMatters', '#SelfImprovement', '#LifeLongLearning']
  },
  travel: {
    tier1: ['#travel', '#wanderlust', '#adventure'],
    tier2: ['#travelgram', '#traveltips', '#explore', '#travelblogger', '#vacation',
            '#backpacking', '#bucketlist', '#travelphotography', '#digitalnomad', '#worldtravel'],
    tier3: ['#travelhacks2026', '#budgettravel', '#solotravel', '#hiddengems', '#travelvlog',
            '#travelreels', '#exploremore', '#travelcouple', '#nomadlife', '#adventuretravel'],
    tier4: ['#viral', '#trending', '#reels', '#travelshorts', '#foryou'],
    fbBonus: ['#TravelCommunity', '#TravelTips', '#ExploreTheWorld']
  },
  default: {
    tier1: ['#viral', '#trending', '#reels'],
    tier2: ['#foryou', '#foryoupage', '#explore', '#shorts', '#content', '#video', '#creator', '#trending2026', '#follow', '#like'],
    tier3: ['#contentcreator', '#youtube', '#instagram', '#socialmedia', '#reelsviral', '#viralvideo', '#shortsvideo', '#videooftheday', '#dailycontent', '#newcontent'],
    tier4: ['#trending', '#viral2026', '#reels', '#foryou', '#explore'],
    fbBonus: ['#ContentCreator', '#VideoContent', '#SocialMedia']
  }
};

// Platform-specific CTA templates
const INSTAGRAM_CTAS = [
  '🔥 Follow @{handle} for daily {niche} content!',
  '💡 Follow for more {niche} tips every day!',
  '🚀 Follow us — new {niche} content drops daily!',
  '👆 Tap Follow — you won\'t regret it!',
  '📲 Follow for your daily dose of {niche}!'
];

const FACEBOOK_CTAS = [
  '💬 What do you think? Drop a comment below!',
  '👍 Like this page for more {niche} content!',
  '🔔 Follow this page — we post daily!',
  '💭 Share with someone who needs to see this!',
  '❤️ React if this helped you today!'
];

export class CaptionGenerator {

  /**
   * Generate Instagram Reels caption (hashtag-heavy)
   */
  static forInstagram(title, niche, keyword = '') {
    const nicheKey = typeof niche === 'object' ? niche?.category : niche;
    const tags = HASHTAG_LIBRARY[nicheKey] || HASHTAG_LIBRARY.default;
    const handle = process.env[`CHANNEL_INSTAGRAM_HANDLE`] || 'our.channel';

    // Build hashtag block: all tiers (max 30)
    const allTags = [
      ...tags.tier1,
      ...tags.tier2,
      ...tags.tier3.slice(0, 8),
      ...tags.tier4
    ].slice(0, 30);

    // Add keyword as hashtag if provided
    if (keyword) {
      const kwTag = '#' + keyword.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
      if (!allTags.includes(kwTag)) allTags.unshift(kwTag);
    }

    const ctaTemplate = INSTAGRAM_CTAS[Math.floor(Math.random() * INSTAGRAM_CTAS.length)];
    const cta = ctaTemplate
      .replace('{handle}', handle)
      .replace('{niche}', nicheKey || 'content');

    const hashtags = allTags.join(' ');

    return `${title}\n\n${cta}\n\n${hashtags}`;
  }

  /**
   * Generate Facebook Reels description (community-focused, less hashtag spam)
   */
  static forFacebook(title, niche, keyword = '') {
    const nicheKey = typeof niche === 'object' ? niche?.category : niche;
    const tags = HASHTAG_LIBRARY[nicheKey] || HASHTAG_LIBRARY.default;

    // FB: fewer hashtags (8-12 max), more conversational
    const fbTags = [
      ...tags.fbBonus,
      ...tags.tier2.slice(0, 4),
      ...tags.tier4.slice(0, 3)
    ].slice(0, 12);

    if (keyword) {
      const kwTag = '#' + keyword.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
      fbTags.unshift(kwTag);
    }

    const ctaTemplate = FACEBOOK_CTAS[Math.floor(Math.random() * FACEBOOK_CTAS.length)];
    const cta = ctaTemplate.replace('{niche}', nicheKey || 'content');

    const hashtags = fbTags.join(' ');

    // FB description has intro paragraph, CTA, then hashtags
    return `${title}\n\n${cta}\n\n${hashtags}`;
  }

  /**
   * Generate captions for both platforms at once
   */
  static generateAll(title, niche, keyword = '') {
    return {
      instagram: CaptionGenerator.forInstagram(title, niche, keyword),
      facebook: CaptionGenerator.forFacebook(title, niche, keyword)
    };
  }

  /**
   * Get hashtag array for a specific niche (for external use)
   */
  static getHashtagsForNiche(niche, tier = 'all', limit = 30) {
    const nicheKey = typeof niche === 'object' ? niche?.category : niche;
    const tags = HASHTAG_LIBRARY[nicheKey] || HASHTAG_LIBRARY.default;

    if (tier === 'tier1') return tags.tier1;
    if (tier === 'tier2') return tags.tier2;
    if (tier === 'tier3') return tags.tier3;
    if (tier === 'tier4') return tags.tier4;

    return [
      ...tags.tier1,
      ...tags.tier2,
      ...tags.tier3,
      ...tags.tier4
    ].slice(0, limit);
  }
}
