$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\ml"
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = (Resolve-Path ".\src").Path
python -m ecosort.train --annotations ..\ml\artifacts\data --output-dir ..\ml\artifacts\models\pro --epochs 14 --batch-size 24 --image-size 192 --max-vocab 1800 --learning-rate 0.0005 --label-smoothing 0.04 --weighted-sampler
