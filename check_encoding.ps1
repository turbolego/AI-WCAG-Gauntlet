$content = Get-Content 'c:\TurbolegoGitHub\AI-WCAG-Gauntlet\test-suite.ps1' -Raw -Encoding UTF8
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$nonAscii = @()
for ($i = 0; $i -lt $bytes.Length; $i++) {
    if ($bytes[$i] -gt 127) {
        $lineNum = 1
        $charCount = 0
        $lines = $content -split "`n"
        foreach ($line in $lines) {
            $charCount += $line.Length + 1
            if ($charCount -gt $i) {
                $lineNum++
                break
            }
        }
        $hexVal = $bytes[$i].ToString('X2')
        $nonAscii += "Pos $i line $lineNum byte 0x$hexVal"
    }
}
Write-Host "Non-ASCII bytes found: $($nonAscii.Count)"
foreach ($item in $nonAscii) {
    Write-Host $item
}