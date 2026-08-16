import fs from "fs/promises";

/**
 * Pollinations.ai is a genuinely free, no-API-key image generation service —
 * a GET request with the prompt URL-encoded into the path returns the image
 * bytes directly. No account, no token. Rate limits are informal and can
 * change without notice; this is a real integration, but not an SLA-backed one.
 */
export async function generateImage(params: {
  prompt: string;
  outputPath: string;
  width?: number;
  height?: number;
}): Promise<string> {
  const { prompt, outputPath, width = 1024, height = 1024 } = params;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pollinations image generation failed (${response.status}) for prompt: "${prompt}"`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer as any);
  return outputPath;
}
