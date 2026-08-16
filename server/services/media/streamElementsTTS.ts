import fs from "fs/promises";

/**
 * StreamElements exposes a free, keyless TTS endpoint originally built for
 * their Twitch bot — no account or token required, plain GET request. This
 * is an unofficial/community-relied-upon endpoint, not a documented public
 * API with guarantees: it can rate-limit, change, or disappear without
 * notice. Treat this as the "real free model" for voiceover, with the
 * understanding that a production deployment should have a paid fallback
 * (e.g. ElevenLabs) for when this endpoint is unavailable.
 */
const MAX_CHARS_PER_REQUEST = 500; // the endpoint truncates/rejects longer text

export async function generateVoiceover(params: {
  text: string;
  outputPath: string;
  voice?: string; // e.g. "Brian", "Amy" — see StreamElements' supported voice list
}): Promise<string> {
  const { text, outputPath, voice = "Brian" } = params;

  const chunks = chunkText(text, MAX_CHARS_PER_REQUEST);
  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(chunk)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`StreamElements TTS failed (${response.status}) for chunk: "${chunk.slice(0, 40)}..."`);
    }
    audioBuffers.push(Buffer.from(await response.arrayBuffer()));
  }

  // Naive concatenation works for MP3 in practice for sequential playback,
  // though a production build should remux with ffmpeg for clean framing
  // rather than relying on raw byte concatenation.
  await fs.writeFile(outputPath, Buffer.concat(audioBuffers as unknown as Uint8Array<ArrayBuffer>[]) as any);
  return outputPath;
}

function chunkText(text: string, maxLen: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
