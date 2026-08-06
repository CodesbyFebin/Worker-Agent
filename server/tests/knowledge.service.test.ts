import { describe, expect, it } from "vitest";
import { cosineSimilarity, fallbackEmbedding } from "../services/knowledge/embeddings";
import { buildOpenApiDocument } from "../routers/openapi";

describe("knowledge semantic scoring", () => {
  it("ranks identical vectors at 1 and orthogonal vectors at 0", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);
  });

  it("is direction-only (scale invariant)", () => {
    expect(cosineSimilarity([1, 1], [2, 2])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 1], [2, 3])).toBeCloseTo(cosineSimilarity([2, 2], [4, 6]), 5);
  });

  it("produces a deterministic 384-dim unit vector per text", () => {
    const a = fallbackEmbedding("hello world");
    const b = fallbackEmbedding("hello world");
    const c = fallbackEmbedding("different text");

    expect(a).toHaveLength(384);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 4);
  });

  it("maps identical text to identical embeddings (so searchSimilar is reproducible)", () => {
    expect(fallbackEmbedding("AI productivity tips")).toEqual(fallbackEmbedding("AI productivity tips"));
  });
});

describe("knowledge OpenAPI contract", () => {
  it("exposes search, semantic and indexing routes under /api/v1", () => {
    const doc = buildOpenApiDocument();
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(["/knowledge/search", "/knowledge/semantic", "/knowledge/embeddings"]),
    );

    const embedPost = (doc.paths as Record<string, unknown>)["/knowledge/embeddings"];
    expect(embedPost).toHaveProperty("post");
    expect((embedPost as { post: { requestBody: unknown } }).post.requestBody).toBeTruthy();
  });
});
