$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\backend"
$projectRoot = Resolve-Path "$PSScriptRoot\.."
$kerasPython = Join-Path $projectRoot ".\ml\.venv-keras\Scripts\python.exe"
$backendPython = Join-Path $projectRoot ".\backend\.venv\Scripts\python.exe"
$pythonExe = if (Test-Path $kerasPython) { $kerasPython } else { $backendPython }

$existing = @(
  Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object { $_.CommandLine -like "*uvicorn*" -and $_.CommandLine -like "*8000*" }
)

$portOwners = @(
  Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
)

$processIds = @($existing.ProcessId + $portOwners) | Where-Object { $_ } | Select-Object -Unique
if ($processIds) {
  Write-Host "EcoSort API ya estaba corriendo. Cerrando instancia anterior para recargar cambios..."
  $processIds | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
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
$wifiProfiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
$localIps = @(
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    ($_.IPAddress -like "10.*" -or $_.IPAddress -like "192.168.*" -or $_.IPAddress -match "^172\.(1[6-9]|2\d|3[0-1])\.")
  } |
  Sort-Object InterfaceAlias,IPAddress
)
$localIps | ForEach-Object {
  $ipInfo = $_
  $profile = $wifiProfiles | Where-Object { $_.InterfaceAlias -eq $ipInfo.InterfaceAlias } | Select-Object -First 1
  $category = if ($profile) { $profile.NetworkCategory } else { "desconocido" }
  Write-Host ("  http://{0}:8000  ({1}, /{2}, perfil {3})" -f $ipInfo.IPAddress, $ipInfo.InterfaceAlias, $ipInfo.PrefixLength, $category)
}
Write-Host ""
Write-Host "Prueba rapida desde el celular: abre http://IP_DE_ARRIBA:8000/health en Chrome."
Write-Host "Si no abre, no es la app: es Firewall de Windows o aislamiento de la red Wi-Fi."
Write-Host "En redes universitarias puede bloquearse la comunicacion celular-laptop aunque ambos tengan internet."
Write-Host "Solucion rapida: usa hotspot del celular o un tunel HTTPS y pega esa URL en la app."
Write-Host ""

& $pythonExe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
