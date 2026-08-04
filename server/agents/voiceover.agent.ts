import path from "path";
import { generateVoiceover } from "../services/media/streamElementsTTS";
import { getAudioDurationSeconds } from "../services/media/ffmpeg";
import type { AgentExecutionContext } from "./base";

export async function executeVoiceoverTask(ctx: AgentExecutionContext): Promise<{
  audioPath: string;
  durationSeconds: number;
}> {
  const audioPath = path.join(ctx.artifactsDir, "voiceover.mp3");
  await generateVoiceover({ text: ctx.instructions, outputPath: audioPath });
  const durationSeconds = await getAudioDurationSeconds(audioPath);
  return { audioPath, durationSeconds };
}
