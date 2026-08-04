import path from "path";
import { muxAudioOntoVideo, burnSubtitles, getAudioDurationSeconds } from "../services/media/ffmpeg";
import { generateProportionalSrt } from "../services/media/srt";
import type { AgentExecutionContext } from "./base";

interface VideoEditPayload {
  videoPath: string;
  audioPath: string;
  scriptText: string;
}

export async function executeVideoEditTask(ctx: AgentExecutionContext): Promise<{
  finalVideoPath: string;
}> {
  const { videoPath, audioPath, scriptText } = ctx.rawPayload as unknown as VideoEditPayload;
  if (!videoPath || !audioPath || !scriptText) {
    throw new Error('Video editor task payload must include "videoPath", "audioPath", and "scriptText"');
  }

  const muxedPath = path.join(ctx.artifactsDir, "muxed.mp4");
  await muxAudioOntoVideo({ videoPath, audioPath, outputPath: muxedPath });

  const durationSeconds = await getAudioDurationSeconds(audioPath);
  const srtPath = path.join(ctx.artifactsDir, "captions.srt");
  await generateProportionalSrt({ scriptText, totalDurationSeconds: durationSeconds, outputPath: srtPath });

  const finalVideoPath = path.join(ctx.artifactsDir, "final.mp4");
  await burnSubtitles({ videoPath: muxedPath, srtPath, outputPath: finalVideoPath });

  return { finalVideoPath };
}
