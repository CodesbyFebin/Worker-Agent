import { metrics } from "../../_core/metrics";
import { pythonBridgeLogger } from "../../_core/logger";

export type ThumbnailScoreResult = {
  score: number;
  emotion: string;
  face_count: number;
};

export type CaptionResult = {
  srt: string;
  segments: Array<{ start: number; end: number; text: string }>;
  language: string;
};

export type AudioAnalysisResult = {
  bpm: number;
  beats: number[];
};

export type ViralityResult = {
  similarity_score: number;
  suggested_rewrite: string;
};

export type ObjectDetectionResult = {
  detections: Array<{ class: string; confidence: number; bbox: number[] }>;
  count: number;
};

export class PythonBridgeError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class PythonBridgeClient {
  private readonly baseUrl: string;
  private readonly logger = pythonBridgeLogger({});

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.PYTHON_API_URL || "http://localhost:8000";
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const start = Date.now();
    this.logger.debug({ path, body: JSON.stringify(body).slice(0, 200) }, "python_bridge_post_started");
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const durationMs = Date.now() - start;
    metrics.pythonBridgeRequestsTotal.inc({ endpoint: path, status: String(res.status) });
    metrics.pythonBridgeDurationMs.observe({ endpoint: path }, durationMs);
    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = await res.text();
      }
      this.logger.error({ path, status: res.status, durationMs, error: parsed }, "python_bridge_post_failed");
      throw new PythonBridgeError(`Python API ${path} failed: ${res.status}`, res.status, parsed);
    }
    this.logger.debug({ path, status: res.status, durationMs }, "python_bridge_post_completed");
    return res.json() as Promise<T>;
  }

  private async upload<T>(path: string, formData: FormData): Promise<T> {
    const start = Date.now();
    this.logger.debug({ path }, "python_bridge_upload_started");
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      body: formData,
    });
    const durationMs = Date.now() - start;
    metrics.pythonBridgeRequestsTotal.inc({ endpoint: path, status: String(res.status) });
    metrics.pythonBridgeDurationMs.observe({ endpoint: path }, durationMs);
    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = await res.text();
      }
      this.logger.error({ path, status: res.status, durationMs, error: parsed }, "python_bridge_upload_failed");
      throw new PythonBridgeError(`Python API ${path} failed: ${res.status}`, res.status, parsed);
    }
    this.logger.debug({ path, status: res.status, durationMs }, "python_bridge_upload_completed");
    return res.json() as Promise<T>;
  }

  async scoreThumbnail(fileBuffer: Buffer, filename = "thumbnail.jpg"): Promise<ThumbnailScoreResult> {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: "image/jpeg" });
    form.append("file", blob, filename);
    return this.upload<ThumbnailScoreResult>("/score-thumbnail", form);
  }

  async generateCaptions(fileBuffer: Buffer, filename = "video.mp4"): Promise<CaptionResult> {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: "video/mp4" });
    form.append("file", blob, filename);
    return this.upload<CaptionResult>("/generate-captions", form);
  }

  async analyzeAudio(fileBuffer: Buffer, filename = "audio.mp3"): Promise<AudioAnalysisResult> {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: "audio/mpeg" });
    form.append("file", blob, filename);
    return this.upload<AudioAnalysisResult>("/analyze-audio", form);
  }

  async checkViralityScore(script: {
    fullScript?: string;
    text?: string;
    title?: string;
    hook?: string;
    cta?: string;
  }): Promise<ViralityResult> {
    return this.post<ViralityResult>("/check-virality-score", script);
  }

  async seedViralDb(scripts: Array<{ fullScript?: string; text?: string }>): Promise<{ seeded: number }> {
    return this.post<{ seeded: number }>("/viral-db/seed", scripts);
  }

  async detectObjects(fileBuffer: Buffer, filename = "image.jpg"): Promise<ObjectDetectionResult> {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: "image/jpeg" });
    form.append("file", blob, filename);
    return this.upload<ObjectDetectionResult>("/detect-objects", form);
  }
}

export const pythonBridge = new PythonBridgeClient();
