import { runAgentTask } from "./base";
import { executeResearchTask } from "./researcher.agent";
import { executeWriteTask } from "./writer.agent";
import { executeReviewTask } from "./reviewer.agent";
import { executeCodeTask } from "./coder.agent";
import { executeQATask } from "./qa.agent";
import { executePublishTask } from "./publisher.agent";
import { executeVideoGenerationTask } from "./videoGenerator.agent";
import { executeVideoEditTask } from "./videoEditor.agent";
import { executeVoiceoverTask } from "./voiceover.agent";
import { executeCaptionHashtagTask } from "./captionHashtag.agent";
import { executeSeoTask } from "./seo.agent";
import type { AgentExecutor } from "./base";
import type { AgentRole } from "../../shared/types";

const EXECUTORS: Partial<Record<AgentRole, AgentExecutor>> = {
  researcher: executeResearchTask as AgentExecutor,
  writer: executeWriteTask as AgentExecutor,
  reviewer: executeReviewTask as AgentExecutor,
  coder: executeCodeTask as AgentExecutor,
  qa: executeQATask as AgentExecutor,
  publisher: executePublishTask as AgentExecutor,
  video_generator: executeVideoGenerationTask as AgentExecutor,
  video_editor: executeVideoEditTask as AgentExecutor,
  voiceover: executeVoiceoverTask as AgentExecutor,
  caption_hashtag: executeCaptionHashtagTask as AgentExecutor,
  seo: executeSeoTask as AgentExecutor,
};

export async function dispatchTask(taskId: string, role: AgentRole): Promise<void> {
  const executor = EXECUTORS[role];
  if (!executor) {
    throw new Error(`No executor registered for agent role "${role}"`);
  }
  await runAgentTask(taskId, executor);
}
