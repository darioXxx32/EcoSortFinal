$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."
python -m ml.src.ecosort.prepare_data --dataset-root .\garbage_classification --output-dir .\ml\artifacts\data --text-variants 3
