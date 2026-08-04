import type { PublishAdapter } from "./types";
import { publishToYoutube } from "./youtube";
import { publishToTiktok } from "./tiktok";
import { publishToInstagram } from "./instagram";
import { publishToFacebook } from "./facebook";
import { publishToTwitter } from "./twitter";
import { publishToLinkedin } from "./linkedin";
import { publishToBlogger } from "./blogger";

export type PublishPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "blogger";

export const PUBLISH_ADAPTERS: Record<PublishPlatform, PublishAdapter> = {
  youtube: publishToYoutube,
  tiktok: publishToTiktok,
  instagram: publishToInstagram,
  facebook: publishToFacebook,
  twitter: publishToTwitter,
  linkedin: publishToLinkedin,
  blogger: publishToBlogger,
};

export type { PublishContent, PublishResult } from "./types";
