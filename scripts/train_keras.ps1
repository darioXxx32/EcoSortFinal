$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\ml"
if (!(Test-Path ".\.venv-keras\Scripts\Activate.ps1")) {
  py -3.11 -m venv .venv-keras
  .\.venv-keras\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
  .\.venv-keras\Scripts\python.exe -m pip install -r requirements-keras.txt
}
.\.venv-keras\Scripts\Activate.ps1
$env:PYTHONPATH = (Resolve-Path ".\src").Path
python -m ecosort.keras_train --annotations ..\ml\artifacts\data --output-dir ..\ml\artifacts\models\keras_pro --epochs 20 --batch-size 32 --image-size 128 --max-vocab 1800 --learning-rate 0.0005 --dropout 0.30 --patience 20 --max-train-samples 9000 --freeze-backbone --class-weight
