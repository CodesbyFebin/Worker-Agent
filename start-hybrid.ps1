param(
  [switch]$SkipNode
)

$ErrorActionPreference = 'Stop'
$script:PYTHON_API_PID = $null
$script:PYTHON_WORKER_PID = $null

function Stop-Hybrid {
  Write-Host ""
  Write-Host "[start-hybrid.ps1] Shutting down..."
  if ($script:PYTHON_API_PID -and !$script:PYTHON_API_PID.HasExited) {
    Stop-Process -Id $script:PYTHON_API_PID.Id -Force -ErrorAction SilentlyContinue
  }
  if ($script:PYTHON_WORKER_PID -and !$script:PYTHON_WORKER_PID.HasExited) {
    Stop-Process -Id $script:PYTHON_WORKER_PID.Id -Force -ErrorAction SilentlyContinue
  }
  Write-Host "[start-hybrid.ps1] Stopped."
}

trap {
  Stop-Hybrid
  exit
}

$condaEnv = $env:CONDA_ENV ?? "yt-automation"
$condaBase = Join-Path $env:USERPROFILE "anaconda3"
$pythonBin = Join-Path $condaBase "envs" $condaEnv "python.exe"

if (Test-Path $pythonBin) {
  Write-Host "[start-hybrid.ps1] Using conda env: $condaEnv"
  $pythonCmd = $pythonBin
} else {
  Write-Host "[start-hybrid.ps1] conda env not found, falling back to system python"
  $pythonCmd = "python"
}

Push-Location (Join-Path $PSScriptRoot "services\python-api")
Write-Host "[start-hybrid.ps1] Starting Python FastAPI server on :8000"
$script:PYTHON_API_PID = Start-Process -FilePath $pythonCmd -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","8000","--workers","1" -NoNewWindow -PassThru
Pop-Location

Start-Sleep -Seconds 2

Push-Location (Join-Path $PSScriptRoot "services\python-worker")
Write-Host "[start-hybrid.ps1] Starting Python RQ worker"
$script:PYTHON_WORKER_PID = Start-Process -FilePath $pythonCmd -ArgumentList "worker.py" -NoNewWindow -PassThru
Pop-Location

Write-Host "[start-hybrid.ps1] Python services started."
Write-Host "[start-hybrid.ps1] FastAPI docs: http://localhost:8000/docs"

if (-not $SkipNode) {
  Write-Host "[start-hybrid.ps1] Starting Node.js stack via npm run dev..."
  npm run dev
} else {
  Write-Host "[start-hybrid.ps1] Node.js start skipped (-SkipNode)."
  Write-Host "[start-hybrid.ps1] Press Ctrl+C to stop Python services."
  try {
    while ($true) { Start-Sleep -Seconds 1 }
  } finally {
    Stop-Hybrid
  }
}
