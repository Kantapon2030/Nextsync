$ErrorActionPreference = "Stop"
$python = "$PSScriptRoot\.venv\Scripts\python.exe"
$wrapper = "$PSScriptRoot\ShotSyncGPUWorker.exe"
if (-not (Test-Path $python)) {
  throw "Worker virtual environment not found. Create gpu-worker/.venv first."
}
if (-not (Test-Path $wrapper)) {
  throw "WinSW wrapper not found at $wrapper."
}
& $wrapper install
& $wrapper start
Write-Host "ShotSyncGPUWorker installed and started."
