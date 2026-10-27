$lines = Get-Content 'c:\TurbolegoGitHub\AI-WCAG-Gauntlet\test-suite.ps1'
$line353 = $lines[352]
Write-Host "Line 353: $line353"
Write-Host "Length: $($line353.Length)"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($line353)
$hex = ($bytes | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
Write-Host "Hex: $hex"