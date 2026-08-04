import { z } from "zod";

export const sectionKindSchema = z.enum(["hook", "body", "cta", "outro", "custom"]);

export const regenerateSectionInput = z.object({
  sectionId: z.string().uuid(),
  /** Optional creative direction, e.g. "make it punchier and more urgent" */
  instruction: z.string().min(1).max(500).optional(),
});

export const regenerateSectionOutput = z.object({
  id: z.string().uuid(),
  content: z.string(),
  wordCount: z.number().int().nonnegative(),
  lastRegeneratedAt: z.string(),
});

export const generateMetadataInput = z.object({
  scriptId: z.string().uuid(),
  /** How many title options to generate */
  titleCount: z.number().int().min(1).max(10).default(5),
});

export const generateMetadataOutput = z.object({
  id: z.string().uuid(),
  scriptId: z.string().uuid(),
  titles: z.array(z.string()),
  description: z.string(),
  tags: z.array(z.string()),
  thumbnailPrompt: z.string().nullable(),
  createdAt: z.string(),
});

export type RegenerateSectionInput = z.infer<typeof regenerateSectionInput>;
export type GenerateMetadataInput = z.infer<typeof generateMetadataInput>;
