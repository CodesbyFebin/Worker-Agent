import { describe, expect, it } from "vitest";
import {
  compileWorkflowGraph,
  hasCompileErrors,
  youtubeLongFormTemplate,
  WORKFLOW_NODE_TYPES,
} from "../services/workflow/types";
import { runComplianceScan } from "../services/youtube/studio";

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
