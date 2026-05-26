$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\backend"
$projectRoot = Resolve-Path "$PSScriptRoot\.."
$kerasPython = Join-Path $projectRoot ".\ml\.venv-keras\Scripts\python.exe"
$backendPython = Join-Path $projectRoot ".\backend\.venv\Scripts\python.exe"
$pythonExe = if (Test-Path $kerasPython) { $kerasPython } else { $backendPython }

$existing = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
  Where-Object { $_.CommandLine -like "*uvicorn app.main:app*" -and $_.CommandLine -like "*8000*" }

if ($existing) {
  Write-Host "EcoSort API ya estaba corriendo. Cerrando instancia anterior para recargar cambios..."
  $existing | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-Sleep -Seconds 2
}

& $pythonExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
