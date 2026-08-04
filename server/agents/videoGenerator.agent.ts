import path from "path";
import { completeJSON } from "../_core/llm";
import { generateImage } from "../services/media/pollinationsImage";
import { imageToKenBurnsClip, concatClips } from "../services/media/ffmpeg";
import type { AgentExecutionContext } from "./base";

interface Scene {
  imagePrompt: string;
  durationSeconds: number;
}

const SYSTEM_PROMPT = `You break a video script into a shot list. Each scene needs a
vivid, concrete image-generation prompt (composition, subject, style) and an
estimated on-screen duration in seconds based on how long that part of the
script would take to narrate. Aim for 4-8 second scenes.`;

export async function executeVideoGenerationTask(ctx: AgentExecutionContext): Promise<{
  videoPath: string;
  sceneCount: number;
}> {
  const { scenes } = await completeJSON<{ scenes: Scene[] }>({
    system: SYSTEM_PROMPT,
    prompt: `Script:\n"""\n${ctx.instructions}\n"""\n\nReturn JSON: { "scenes": [{ "imagePrompt": string, "durationSeconds": number }] }`,
    maxTokens: 1200,
  });

  if (!scenes?.length) throw new Error("Video generator produced no scenes");

  const clipPaths: string[] = [];
  for (const [index, scene] of scenes.entries()) {
    const imagePath = path.join(ctx.artifactsDir, `scene-${index}.png`);
    await generateImage({ prompt: scene.imagePrompt, outputPath: imagePath });

    const clipPath = path.join(ctx.artifactsDir, `clip-${index}.mp4`);
    await imageToKenBurnsClip({
      imagePath,
      outputPath: clipPath,
      durationSeconds: scene.durationSeconds,
    });
    clipPaths.push(clipPath);
  }

  const videoPath = path.join(ctx.artifactsDir, "assembled-silent.mp4");
  await concatClips(clipPaths, videoPath);

  return { videoPath, sceneCount: scenes.length };
}
