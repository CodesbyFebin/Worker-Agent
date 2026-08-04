import { describe, expect, it } from "vitest";
import { nextStage, PIPELINE_STAGES, draftToSections } from "../services/pipeline/contentOpsPipeline";

describe("contentOpsPipeline.nextStage", () => {
  it("advances through the content ops chain", () => {
    expect(nextStage("god_machine")).toBe("script_studio");
    expect(nextStage("publishing")).toBe("done");
    expect(nextStage("done")).toBeNull();
  });

  it("covers every stage except the terminal one", () => {
    for (const stage of PIPELINE_STAGES.slice(0, -1)) {
      expect(nextStage(stage)).not.toBeNull();
    }
  });
});

describe("contentOpsPipeline.draftToSections", () => {
  it("splits a three-paragraph draft into hook/body/cta", () => {
    const sections = draftToSections("Hook line.\n\nBody paragraph here.\n\nCall to action.");
    expect(sections).toHaveLength(3);
    expect(sections[0]?.kind).toBe("hook");
    expect(sections[1]?.kind).toBe("body");
    expect(sections[2]?.kind).toBe("cta");
  });
});
