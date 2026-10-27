$errors = $null
$tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile('test-suite.ps1', [ref]$tokens, [ref]$errors)
$errors.Count
$errors | Format-List -Property *