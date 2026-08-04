import { randomUUID } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { scriptSections, scripts, generatedMetadata } from "../../drizzle/schema";
import {
  regenerateSectionInput,
  regenerateSectionOutput,
  generateMetadataInput,
  generateMetadataOutput,
} from "../../shared/contracts/script.contract";
import { regenerateSectionText } from "../services/script/regenerateSection";
import { generateYoutubeMetadata } from "../services/metadata/youtubeMetadata";
import { generateThumbnailPrompt } from "../services/metadata/thumbnailPrompter";

function sectionToDTO(row: typeof scriptSections.$inferSelect) {
  return {
    id: row.id,
    scriptId: row.scriptId,
    kind: row.kind,
    order: row.order,
    content: row.content,
    wordCount: row.wordCount,
    lastRegeneratedAt: row.lastRegeneratedAt?.toISOString() ?? null,
  };
}

export const scriptRouter = router({
  /** Lists scripts owned by the current user, newest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(scripts)
      .where(eq(scripts.userId, ctx.userId!))
      .orderBy(desc(scripts.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      targetDurationSeconds: row.targetDurationSeconds ?? 60,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ scriptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [script] = await ctx.db
        .select()
        .from(scripts)
        .where(and(eq(scripts.id, input.scriptId), eq(scripts.userId, ctx.userId!)))
        .limit(1);

      if (!script) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Script not found" });
      }

      const sections = await ctx.db
        .select()
        .from(scriptSections)
        .where(eq(scriptSections.scriptId, script.id))
        .orderBy(asc(scriptSections.order));

      return {
        id: script.id,
        title: script.title,
        fullText: script.fullText,
        targetDurationSeconds: script.targetDurationSeconds ?? 60,
        createdAt: script.createdAt.toISOString(),
        updatedAt: script.updatedAt.toISOString(),
        sections: sections.map(sectionToDTO),
      };
    }),

  /**
   * Creates a script with default hook/body/cta sections. Content is whatever
   * the user typed — empty placeholders are allowed so the studio can open
   * immediately and regenerate later.
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        targetDurationSeconds: z.number().int().min(5).max(3600).default(60),
        sections: z
          .array(
            z.object({
              kind: z.enum(["hook", "body", "cta", "outro", "custom"]),
              content: z.string(),
            }),
          )
          .min(1)
          .max(20)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = randomUUID();
      const now = new Date();
      const sectionDefs =
        input.sections ??
        ([
          { kind: "hook" as const, content: "" },
          { kind: "body" as const, content: "" },
          { kind: "cta" as const, content: "" },
        ] as const);

      const fullText = sectionDefs.map((s) => s.content).join("\n\n").trim();

      await ctx.db.insert(scripts).values({
        id,
        userId: ctx.userId!,
        title: input.title,
        fullText,
        targetDurationSeconds: input.targetDurationSeconds,
        createdAt: now,
        updatedAt: now,
      });

      const sectionRows = sectionDefs.map((s, order) => ({
        id: randomUUID(),
        scriptId: id,
        kind: s.kind,
        order,
        content: s.content,
        wordCount: s.content.split(/\s+/).filter(Boolean).length,
        lastRegeneratedAt: null,
        createdAt: now,
        updatedAt: now,
      }));

      await ctx.db.insert(scriptSections).values(sectionRows);

      return {
        id,
        title: input.title,
        targetDurationSeconds: input.targetDurationSeconds,
        sections: sectionRows.map(sectionToDTO),
      };
    }),

  /** Persists a manual section edit and refreshes the parent script's fullText. */
  updateSection: protectedProcedure
    .input(
      z.object({
        sectionId: z.string().uuid(),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [section] = await ctx.db
        .select()
        .from(scriptSections)
        .where(eq(scriptSections.id, input.sectionId))
        .limit(1);

      if (!section) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      }

      const [script] = await ctx.db
        .select()
        .from(scripts)
        .where(and(eq(scripts.id, section.scriptId), eq(scripts.userId, ctx.userId!)))
        .limit(1);

      if (!script) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Script not found" });
      }

      const wordCount = input.content.split(/\s+/).filter(Boolean).length;
      const now = new Date();

      await ctx.db
        .update(scriptSections)
        .set({ content: input.content, wordCount, updatedAt: now })
        .where(eq(scriptSections.id, input.sectionId));

      const allSections = await ctx.db
        .select()
        .from(scriptSections)
        .where(eq(scriptSections.scriptId, script.id))
        .orderBy(asc(scriptSections.order));

      const fullText = allSections
        .map((s) => (s.id === input.sectionId ? input.content : s.content))
        .join("\n\n")
        .trim();

      await ctx.db.update(scripts).set({ fullText, updatedAt: now }).where(eq(scripts.id, script.id));

      return {
        id: section.id,
        scriptId: section.scriptId,
        kind: section.kind,
        order: section.order,
        content: input.content,
        wordCount,
        lastRegeneratedAt: section.lastRegeneratedAt?.toISOString() ?? null,
      };
    }),

  regenerateSection: protectedProcedure
    .input(regenerateSectionInput)
    .output(regenerateSectionOutput)
    .mutation(async ({ ctx, input }) => {
      const [section] = await ctx.db
        .select()
        .from(scriptSections)
        .where(eq(scriptSections.id, input.sectionId))
        .limit(1);

      if (!section) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      }

      const [script] = await ctx.db
        .select()
        .from(scripts)
        .where(and(eq(scripts.id, section.scriptId), eq(scripts.userId, ctx.userId!)))
        .limit(1);

      if (!script) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Script not found" });
      }

      const newContent = await regenerateSectionText({
        kind: section.kind,
        currentContent: section.content,
        instruction: input.instruction,
      });

      const wordCount = newContent.split(/\s+/).filter(Boolean).length;
      const lastRegeneratedAt = new Date();

      await ctx.db
        .update(scriptSections)
        .set({ content: newContent, wordCount, lastRegeneratedAt, updatedAt: lastRegeneratedAt })
        .where(eq(scriptSections.id, input.sectionId));

      const allSections = await ctx.db
        .select()
        .from(scriptSections)
        .where(eq(scriptSections.scriptId, script.id))
        .orderBy(asc(scriptSections.order));

      const fullText = allSections
        .map((s) => (s.id === input.sectionId ? newContent : s.content))
        .join("\n\n")
        .trim();

      await ctx.db
        .update(scripts)
        .set({ fullText, updatedAt: lastRegeneratedAt })
        .where(eq(scripts.id, script.id));

      return {
        id: section.id,
        content: newContent,
        wordCount,
        lastRegeneratedAt: lastRegeneratedAt.toISOString(),
      };
    }),

  generateMetadata: protectedProcedure
    .input(generateMetadataInput)
    .output(generateMetadataOutput)
    .mutation(async ({ ctx, input }) => {
      const [script] = await ctx.db
        .select()
        .from(scripts)
        .where(and(eq(scripts.id, input.scriptId), eq(scripts.userId, ctx.userId!)))
        .limit(1);

      if (!script) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Script not found" });
      }

      if (!script.fullText.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Script has no text yet — write or regenerate sections first",
        });
      }

      const [metadata, thumbnailPrompt] = await Promise.all([
        generateYoutubeMetadata({ scriptText: script.fullText, titleCount: input.titleCount }),
        generateThumbnailPrompt(script.fullText),
      ]);

      const id = randomUUID();
      const createdAt = new Date();

      await ctx.db.insert(generatedMetadata).values({
        id,
        scriptId: script.id,
        titles: JSON.stringify(metadata.titles),
        description: metadata.description,
        tags: JSON.stringify(metadata.tags),
        thumbnailPrompt,
        createdAt,
      });

      return {
        id,
        scriptId: script.id,
        titles: metadata.titles,
        description: metadata.description,
        tags: metadata.tags,
        thumbnailPrompt,
        createdAt: createdAt.toISOString(),
      };
    }),
});
