import fs from "fs/promises";

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Splits the script into sentences and distributes the known total audio
 * duration proportionally by character count. This is a heuristic, not a
 * real forced-alignment (e.g. word-level Whisper timestamps) — captions
 * will drift slightly from the actual spoken audio, more so on longer
 * scripts. Good enough for a first cut; swap in real alignment before
 * shipping anything caption-accuracy-sensitive.
 */
export async function generateProportionalSrt(params: {
  scriptText: string;
  totalDurationSeconds: number;
  outputPath: string;
}): Promise<string> {
  const { scriptText, totalDurationSeconds, outputPath } = params;
  const sentences = scriptText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1;

  let cursor = 0;
  const lines: string[] = [];

  sentences.forEach((sentence, i) => {
    const duration = (sentence.length / totalChars) * totalDurationSeconds;
    const start = cursor;
    const end = Math.min(cursor + duration, totalDurationSeconds);
    cursor = end;

    lines.push(
      `${i + 1}`,
      `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
      sentence,
      "",
    );
  });

  await fs.writeFile(outputPath, lines.join("\n"), "utf-8");
  return outputPath;
}
