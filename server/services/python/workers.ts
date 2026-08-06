import path from "path";
import { registerWorker, pythonTranscriptionQueue, pythonAudioAnalysisQueue, pythonThumbnailScoreQueue } from "../../_core/queue";
import { pythonBridge } from "./bridge";

export function registerPythonTranscriptionWorker() {
  return registerWorker<string>(
    "python-transcription",
    async (videoPath) => {
      const fs = await import("fs/promises");
      const buffer = await fs.readFile(videoPath);
      const result = await pythonBridge.generateCaptions(buffer, path.basename(videoPath));
      console.log(`[python-transcription] completed for ${videoPath}: ${result.segments.length} segments`);
    },
    async (videoPath, error) => {
      console.error(`[python-transcription] exhausted for ${videoPath}:`, error.message);
    },
  );
}

export function registerPythonAudioAnalysisWorker() {
  return registerWorker<string>(
    "python-audio-analysis",
    async (audioPath) => {
      const fs = await import("fs/promises");
      const buffer = await fs.readFile(audioPath);
      const result = await pythonBridge.analyzeAudio(buffer, path.basename(audioPath));
      console.log(`[python-audio-analysis] completed for ${audioPath}: ${result.bpm} BPM`);
    },
    async (audioPath, error) => {
      console.error(`[python-audio-analysis] exhausted for ${audioPath}:`, error.message);
    },
  );
}

export function registerPythonThumbnailScoreWorker() {
  return registerWorker<string>(
    "python-thumbnail-score",
    async (imagePath) => {
      const fs = await import("fs/promises");
      const buffer = await fs.readFile(imagePath);
      const result = await pythonBridge.scoreThumbnail(buffer, path.basename(imagePath));
      console.log(`[python-thumbnail-score] completed for ${imagePath}: ${result.score} (${result.emotion})`);
    },
    async (imagePath, error) => {
      console.error(`[python-thumbnail-score] exhausted for ${imagePath}:`, error.message);
    },
  );
}
