import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

/** Requires `ffmpeg` and `ffprobe` on PATH. Not vendored — install via your OS package manager. */
export async function getAudioDurationSeconds(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  return parseFloat(stdout.trim());
}

/** Turns a single still image into a slow zoom/pan ("Ken Burns") clip of the given duration. */
export async function imageToKenBurnsClip(params: {
  imagePath: string;
  outputPath: string;
  durationSeconds: number;
  fps?: number;
}): Promise<string> {
  const { imagePath, outputPath, durationSeconds, fps = 30 } = params;
  const frames = Math.round(durationSeconds * fps);

  await execFileAsync("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-vf",
    `zoompan=z='min(zoom+0.0008,1.15)':d=${frames}:s=1920x1080:fps=${fps}`,
    "-t",
    String(durationSeconds),
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ]);

  return outputPath;
}

/** Concatenates several clips (same codec/resolution) into one, via ffmpeg's concat demuxer. */
export async function concatClips(clipPaths: string[], outputPath: string): Promise<string> {
  const listFile = path.join(path.dirname(outputPath), `concat-${Date.now()}.txt`);
  const listContent = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.writeFile(listFile, listContent, "utf-8");

  await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outputPath]);
  await fs.unlink(listFile).catch(() => undefined);

  return outputPath;
}

/** Muxes a silent video with a narration track, trimming/padding video to match audio length. */
export async function muxAudioOntoVideo(params: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}): Promise<string> {
  const { videoPath, audioPath, outputPath } = params;
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
    outputPath,
  ]);
  return outputPath;
}

/** Burns an .srt subtitle file into the video (hardcoded captions, not a selectable track). */
export async function burnSubtitles(params: {
  videoPath: string;
  srtPath: string;
  outputPath: string;
}): Promise<string> {
  const { videoPath, srtPath, outputPath } = params;
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    `subtitles=${srtPath.replace(/:/g, "\\:")}`,
    "-c:a",
    "copy",
    outputPath,
  ]);
  return outputPath;
}
