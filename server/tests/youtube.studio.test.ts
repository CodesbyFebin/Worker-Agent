import { describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "node:path";
import {
  compileWorkflowGraph,
  hasCompileErrors,
  youtubeLongFormTemplate,
  WORKFLOW_NODE_TYPES,
} from "../services/workflow/types";
import type { StepContext } from "../services/workflow/executors";
import { executeNode } from "../services/workflow/executors";
import { runComplianceScan } from "../services/youtube/studio";

vi.mock("../services/python/bridge", () => ({
  pythonBridge: {
    generateCaptions: vi.fn().mockResolvedValue({
      srt: "00:00:00,000 --> 00:00:01,000\nhi",
      segments: [{ start: 0, end: 1, text: "hi" }],
      language: "en",
    }),
    analyzeAudio: vi.fn(),
    scoreThumbnail: vi.fn(),
    checkViralityScore: vi.fn(),
  },
}));

import { pythonBridge } from "../services/python/bridge";

describe("youtube studio workflow template", () => {
  it("compiles the long-form template without errors", () => {
    const compiled = compileWorkflowGraph(youtubeLongFormTemplate());
    expect(hasCompileErrors(compiled)).toBe(false);
    expect(compiled.triggers).toHaveLength(1);
    const types = compiled.graph.nodes.map((n) => n.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "video.script",
        "video.compliance",
        "video.voice",
        "video.broll",
        "video.assemble",
        "youtube.upload",
      ]),
    );
  });

  it("registers youtube node types in the shared enum", () => {
    expect(WORKFLOW_NODE_TYPES).toContain("video.script");
    expect(WORKFLOW_NODE_TYPES).toContain("youtube.upload");
  });
});

describe("sanity shield compliance", () => {
  it("passes clean educational copy", () => {
    const r = runComplianceScan("Here is a careful explanation of quantum gates with sources.");
    expect(r.ok).toBe(true);
  });

  it("holds on demonetization-ish spam phrases", () => {
    const r = runComplianceScan("Buy followers now and get rich quick with this hack.");
    expect(r.ok).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
  });
});

describe("long-form pipeline wires Python superpowers", () => {
  it("registers python.* node types in the shared palette", () => {
    expect(WORKFLOW_NODE_TYPES).toContain("python.caption");
    expect(WORKFLOW_NODE_TYPES).toContain("python.thumbnail.score");
  });

  it("inserts the WhisperX caption step (assemble -> caption -> upload)", () => {
    const compiled = compileWorkflowGraph(youtubeLongFormTemplate());
    expect(hasCompileErrors(compiled)).toBe(false);
    const ids = compiled.graph.nodes.map((n) => n.id);
    expect(ids).toContain("caption");
    expect(compiled.graph.nodes.find((n) => n.id === "caption")?.type).toBe(
      "python.caption",
    );
    const edgeSources = (target: string) =>
      compiled.graph.edges.filter((e) => e.target === target).map((e) => e.source);
    expect(edgeSources("caption")).toContain("assemble");
    expect(edgeSources("upload")).toContain("caption");
  });

  it("delegates python.caption to the Python bridge (Node -> Anaconda)", async () => {
    const tmp = path.join(os.tmpdir(), `wa-caption-${Date.now()}.mp4`);
    await fs.writeFile(tmp, Buffer.from("fake-video-bytes"));
    try {
      const ctx = {
        organizationId: "org-test",
        workflowRunId: "run-test",
        stepRunId: "step-test",
        runInput: {},
        parentOutputs: { assemble: { videoPath: tmp, method: "kenburns+mux" } },
        node: {
          id: "caption",
          type: "python.caption",
          name: "Captions",
          config: { fromNode: "assemble" },
          errorStrategy: "retry_with_backoff",
          maxAttempts: 2,
        },
      } as unknown as StepContext;

      const res = await executeNode(ctx);
      expect(res.status).toBe("completed");
      expect((res.output as { segments: unknown[] }).segments).toHaveLength(1);
      expect(pythonBridge.generateCaptions).toHaveBeenCalledTimes(1);
      expect(pythonBridge.generateCaptions).toHaveBeenCalledWith(
        expect.any(Buffer),
        `${path.basename(tmp)}`,
      );
    } finally {
      await fs.rm(tmp, { force: true });
    }
  });
});
