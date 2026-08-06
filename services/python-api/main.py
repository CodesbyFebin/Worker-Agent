from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import os
import tempfile
import json
import redis
import logging

logger = logging.getLogger("python-api")

app = FastAPI(
    title="Worker Agent Python Bridge",
    description="Hybrid AI microservice layer for the Node.js orchestrator",
    version="0.1.0",
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


# ============================================================
# 1. Thumbnail Shock-Scorer (OpenCV + DeepFace emotion detection)
# ============================================================

@app.post("/score-thumbnail")
async def score_thumbnail(file: UploadFile = File(...)):
    try:
        import cv2
        import numpy as np
        from deepface import DeepFace

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        img = cv2.imread(tmp_path)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        if len(faces) == 0:
            return {"score": 10.0, "emotion": "neutral", "face_count": 0}

        emotions = []
        for (x, y, w, h) in faces:
            roi = img[y : y + h, x : x + w]
            try:
                result = DeepFace.analyze(roi, actions=["emotion"], enforce_detection=False)
                dom = result[0]["dominant_emotion"] if isinstance(result, list) else result["dominant_emotion"]
                emotions.append(dom)
            except Exception:
                emotions.append("neutral")

        dominant = max(set(emotions), key=emotions.count)
        surprise_score = {"surprise": 95, "happy": 75, "neutral": 40, "fear": 85, "angry": 70, "disgust": 55, "sad": 30}
        score = float(surprise_score.get(dominant, 50))

        try:
            os.unlink(tmp_path)
        except OSError:
            pass

        return {"score": score, "emotion": dominant, "face_count": len(faces)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("score-thumbnail failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================
# 2. Ultra-Fast Caption Generator (WhisperX)
# ============================================================

@app.post("/generate-captions")
async def generate_captions(file: UploadFile = File(...)):
    try:
        import whisperx
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            audio_path = tmp.name

        try:
            model = whisperx.load_model("large-v3", device, compute_type=compute_type)
            audio = whisperx.load_audio(audio_path)
            result = model.transcribe(audio, batch_size=16, language="en")
            model_a, metadata = whisperx.load_align_model(language_code=result["language"])
            result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)

            segments = []
            for seg in result.get("segments", []):
                segments.append({
                    "start": seg.get("start", 0),
                    "end": seg.get("end", 0),
                    "text": seg.get("text", "").strip(),
                })

            srt_lines = []
            for i, seg in enumerate(segments, 1):
                srt_lines.append(f"{i}")
                srt_lines.append(f"{_fmt_ts(seg['start'])} --> {_fmt_ts(seg['end'])}")
                srt_lines.append(seg["text"])
                srt_lines.append("")
            srt = "\n".join(srt_lines)

            return {"srt": srt, "segments": segments, "language": result.get("language", "en")}
        finally:
            try:
                os.unlink(audio_path)
            except OSError:
                pass
    except Exception as exc:
        logger.exception("generate-captions failed")
        raise HTTPException(status_code=500, detail=str(exc))


def _fmt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ============================================================
# 3. BPM / Audio Sync Detector (Librosa)
# ============================================================

@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    try:
        import librosa

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            audio_path = tmp.name

        try:
            y, sr = librosa.load(audio_path, sr=None)
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
            return {
                "bpm": round(float(tempo), 2),
                "beats": [round(float(t), 3) for t in beat_times],
            }
        finally:
            try:
                os.unlink(audio_path)
            except OSError:
                pass
    except Exception as exc:
        logger.exception("analyze-audio failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================
# 4. Vector Similarity (Sentence Transformers - The Drake Test)
# ============================================================

from sentence_transformers import SentenceTransformer

_embedding_model = None

def _get_model():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


@app.post("/check-virality-score")
async def check_virality(script: dict):
    try:
        model = _get_model()
        text = script.get("fullScript") or script.get("text") or json.dumps(script)
        embedding = model.encode(text)

        viral_db_key = "viral-script-embeddings"
        stored_raw = redis_client.get(viral_db_key)
        if stored_raw:
            viral_embeddings = json.loads(stored_raw)
        else:
            viral_embeddings = []

        if not viral_embeddings:
            return {
                "similarity_score": 0.5,
                "suggested_rewrite": "No viral DB loaded — using default threshold",
            }

        import numpy as np
        scores = [
            float(np.dot(embedding, np.array(v)) / (np.linalg.norm(embedding) * np.linalg.norm(v) + 1e-9))
            for v in viral_embeddings
        ]
        best = max(scores) if scores else 0.0
        return {
            "similarity_score": round(best, 4),
            "suggested_rewrite": best < 0.7
                ? "Script deviates too far from proven viral patterns. Add stronger hook or CTA."
                : "Script aligns with viral patterns.",
        }
    except Exception as exc:
        logger.exception("check-virality-score failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/viral-db/seed")
async def seed_viral_db(scripts: list[dict]):
    try:
        model = _get_model()
        texts = [s.get("fullScript") or s.get("text") or "" for s in scripts]
        embeddings = model.encode(texts).tolist()
        redis_client.set("viral-script-embeddings", json.dumps(embeddings))
        return {"seeded": len(embeddings)}
    except Exception as exc:
        logger.exception("seed-viral-db failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================
# 5. B-roll Object Detection (YOLOv8 - banned object scanning)
# ============================================================

@app.post("/detect-objects")
async def detect_objects(file: UploadFile = File(...)):
    try:
        from ultralytics import YOLO

        model = YOLO("yolov8n.pt")
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            img_path = tmp.name

        try:
            results = model(img_path)
            detections = []
            for r in results:
                for box in r.boxes:
                    detections.append({
                        "class": model.names[int(box.cls)],
                        "confidence": float(box.conf),
                        "bbox": box.xyxy[0].tolist(),
                    })
            return {"detections": detections, "count": len(detections)}
        finally:
            try:
                os.unlink(img_path)
            except OSError:
                pass
    except Exception as exc:
        logger.exception("detect-objects failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================
# 6. Health check
# ============================================================

@app.get("/health")
async def health():
    return {"status": "ok", "redis": "connected"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
