import { describe, expect, it } from "vitest";
import {
  compileWorkflowGraph,
  defaultManualWorkflowGraph,
  hasCompileErrors,
} from "../services/workflow/types";

describe("workflow graph compiler", () => {
  it("accepts the default manual starter graph", () => {
    const compiled = compileWorkflowGraph(defaultManualWorkflowGraph());
    expect(hasCompileErrors(compiled)).toBe(false);
    expect(compiled.triggers).toHaveLength(1);
    expect(compiled.adjacency.get("trigger")).toContain("transform");
  });

  it("rejects graphs without a trigger", () => {
    const compiled = compileWorkflowGraph({
      nodes: [
        {
          id: "a",
          type: "logic.transform",
          name: "T",
          config: {},
          errorStrategy: "stop_workflow",
          maxAttempts: 1,
        },
      ],
      edges: [],
    });
    expect(hasCompileErrors(compiled)).toBe(true);
  });

  it("detects cycles", () => {
    const compiled = compileWorkflowGraph({
      nodes: [
        {
          id: "t",
          type: "trigger.manual",
          name: "T",
          config: {},
          errorStrategy: "stop_workflow",
          maxAttempts: 1,
        },
        {
          id: "a",
          type: "logic.transform",
          name: "A",
          config: {},
          errorStrategy: "stop_workflow",
          maxAttempts: 1,
        },
        {
          id: "b",
          type: "logic.transform",
          name: "B",
          config: {},
          errorStrategy: "stop_workflow",
          maxAttempts: 1,
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "a" },
        { id: "e2", source: "a", target: "b" },
        { id: "e3", source: "b", target: "a" },
      ],
    });
    expect(hasCompileErrors(compiled)).toBe(true);
    expect(compiled.issues.some((i) => i.message.includes("cycle"))).toBe(true);
  });
});
