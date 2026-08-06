from redis import Redis
from rq import Worker, Queue, Connection
import json
import os
import logging

logger = logging.getLogger("python-worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_conn = Redis.from_url(REDIS_URL)


def process_transcription(video_path: str) -> dict:
    try:
        import whisperx
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        model = whisperx.load_model("large-v3", device, compute_type=compute_type)
        audio = whisperx.load_audio(video_path)
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
        return {"segments": segments, "language": result.get("language", "en")}
    except Exception as exc:
        logger.exception("transcription failed for %s", video_path)
        raise


def process_audio_analysis(audio_path: str) -> dict:
    try:
        import librosa

        y, sr = librosa.load(audio_path, sr=None)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        return {
            "bpm": round(float(tempo), 2),
            "beats": [round(float(t), 3) for t in beat_times],
        }
    except Exception as exc:
        logger.exception("audio analysis failed for %s", audio_path)
        raise


def process_score_thumbnail(image_path: str) -> dict:
    try:
        import cv2
        import numpy as np
        from deepface import DeepFace

        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Invalid image file")

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
        return {"score": score, "emotion": dominant, "face_count": len(faces)}
    except Exception as exc:
        logger.exception("thumbnail scoring failed for %s", image_path)
        raise


TASK_HANDLERS = {
    "whisper.transcribe": process_transcription,
    "audio.analyze": process_audio_analysis,
    "thumbnail.score": process_score_thumbnail,
}


if __name__ == "__main__":
    with Connection(redis_conn):
        queues = {Queue(name) for name in TASK_HANDLERS.keys()}
        worker = Worker(queues)
        logger.info("Python RQ worker started, listening to queues: %s", list(TASK_HANDLERS.keys()))
        worker.work()
