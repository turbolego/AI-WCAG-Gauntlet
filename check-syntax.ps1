param([string]$Path = (Join-Path $PSScriptRoot 'test-suite.ps1'))

$ErrorActionPreference = "Stop"
$errors = $null
$tokens = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $Path).Path, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Host "ERROR: $($_.Message) at line $($_.Extent.StartLineNumber)" }
    exit 1
} else {
    Write-Host "No syntax errors found"
}