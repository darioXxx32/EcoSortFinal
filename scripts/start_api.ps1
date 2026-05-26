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

Write-Host ""
Write-Host "Python usado: $pythonExe"
if ($pythonExe -eq $kerasPython) {
  Write-Host "Modo esperado: Keras multimodal (.keras + texto + reglas). La primera carga puede tardar."
} else {
  Write-Host "Aviso: no encontre ml/.venv-keras; el backend puede caer a modo semantico."
}
Write-Host ""
Write-Host "EcoSort API escuchara en todas las interfaces: http://0.0.0.0:8000"
Write-Host "URLs probables para el celular:"
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    ($_.IPAddress -like "10.*" -or $_.IPAddress -like "192.168.*" -or $_.IPAddress -match "^172\.(1[6-9]|2\d|3[0-1])\.")
  } |
  Sort-Object InterfaceAlias,IPAddress |
  ForEach-Object { Write-Host ("  http://{0}:8000  ({1})" -f $_.IPAddress, $_.InterfaceAlias) }
Write-Host ""
Write-Host "Si el celular no conecta, permite Python/Uvicorn en Firewall de Windows para redes privadas."
Write-Host ""

& $pythonExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
