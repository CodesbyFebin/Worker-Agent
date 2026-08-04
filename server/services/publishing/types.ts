export interface PublishContent {
  title: string;
  description: string;
  tags?: string[];
  /** URL of the already-rendered video/image file to publish, if applicable. */
  mediaUrl?: string;
  /** Plain text body, for text-first platforms (X, LinkedIn, Blogger). */
  bodyText?: string;
}

export interface PublishResult {
  platform: string;
  publishedUrl: string;
  externalId: string;
}

export type PublishAdapter = (content: PublishContent) => Promise<PublishResult>;

export class PublisherConfigError extends Error {
  constructor(platform: string, missingVars: string[]) {
    super(`${platform} is not configured — set ${missingVars.join(", ")} to publish here.`);
    this.name = "PublisherConfigError";
  }
}
