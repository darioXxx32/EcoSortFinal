$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\ml"
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = (Resolve-Path ".\src").Path
python -m ecosort.train --annotations ..\ml\artifacts\data --output-dir ..\ml\artifacts\models\lite --epochs 2 --batch-size 16 --image-size 128 --max-train-samples 1200
