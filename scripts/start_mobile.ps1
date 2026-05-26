$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\mobile"
npm.cmd install
npx.cmd expo start --clear
