param([string]$Path = (Join-Path $PSScriptRoot 'benchmarks'))

$latest = Get-ChildItem -Directory -Path $Path -Recurse |
	Where-Object { Test-Path (Join-Path $_.FullName 'index.html') -PathType Leaf } |
	Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host $latest.FullName