$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\backend"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Write-Host "Entorno de backend listo."
