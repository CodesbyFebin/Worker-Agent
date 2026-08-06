#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Resolve conda python; fall back to system python if conda is unavailable.
CONDA_ENV="${CONDA_ENV:-yt-automation}"
CONDA_BIN="${HOME}/anaconda3/bin/conda"
PYTHON_BIN="${HOME}/anaconda3/envs/${CONDA_ENV}/bin/python"

if [ -x "$PYTHON_BIN" ]; then
  echo "[start-hybrid] Using conda env: ${CONDA_ENV}"
  PYTHON_RUNNER=("$PYTHON_BIN")
else
  echo "[start-hybrid] conda env not found, falling back to system python"
  PYTHON_RUNNER=("python")
fi

mkdir -p services/python-api/services/python-worker/output

echo "[start-hybrid] Starting Python FastAPI server on :8000"
pushd services/python-api >/dev/null
"${PYTHON_RUNNER[@]}" -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 --reload &
PYTHON_API_PID=$!
popd >/dev/null

echo "[start-hybrid] Starting Python RQ worker"
pushd services/python-worker >/dev/null
"${PYTHON_RUNNER[@]}" worker.py &
PYTHON_WORKER_PID=$!
popd >/dev/null

cleanup() {
  echo ""
  echo "[start-hybrid] Shutting down..."
  kill $PYTHON_API_PID $PYTHON_WORKER_PID 2>/dev/null || true
  wait 2>/dev/null || true
  echo "[start-hybrid] Stopped."
}
trap cleanup SIGINT SIGTERM EXIT

echo "[start-hybrid] Python services started."
echo "[start-hybrid] FastAPI docs: http://localhost:8000/docs"
echo "[start-hybrid] Starting Node.js stack via npm run dev..."
npm run dev
