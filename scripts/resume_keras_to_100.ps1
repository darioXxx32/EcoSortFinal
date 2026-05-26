$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\ml"
.\.venv-keras\Scripts\Activate.ps1
$env:PYTHONPATH = (Resolve-Path ".\src").Path
python -m ecosort.keras_train --annotations ..\ml\artifacts\data --output-dir ..\ml\artifacts\models\keras_pro --epochs 40 --batch-size 32 --image-size 128 --max-vocab 1800 --learning-rate 0.000001 --dropout 0.30 --patience 40 --max-train-samples 9000 --freeze-backbone --class-weight --resume
