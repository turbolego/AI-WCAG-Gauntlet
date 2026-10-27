$content = [System.IO.File]::ReadAllText('test-suite.ps1')
$errors = $null
$tokens = $null

try {
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$tokens, [ref]$errors)
    if ($errors) {
        foreach ($err in $errors) {
            Write-Host "$($err.Message) [Line: $($err.LineNumber)]"
        }
    } else {
        Write-Host "No parse errors found"
    }
} catch {
    Write-Host "Exception: $($_.Exception.Message)"
}