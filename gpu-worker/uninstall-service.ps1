$ErrorActionPreference = "Stop"
$wrapper = "$PSScriptRoot\ShotSyncGPUWorker.exe"
& $wrapper stop
& $wrapper uninstall
