$ErrorActionPreference = "Stop"
$python = (Get-Command python).Source
& $python "$PSScriptRoot\service.py" stop
& $python "$PSScriptRoot\service.py" remove
