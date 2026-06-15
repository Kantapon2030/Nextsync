$ErrorActionPreference = "Stop"
$python = (Get-Command python).Source
& $python -m pip install -r "$PSScriptRoot\requirements.txt"
& $python "$PSScriptRoot\service.py" --startup auto install
& $python "$PSScriptRoot\service.py" start
Write-Host "ShotSyncGPUWorker installed and started."
