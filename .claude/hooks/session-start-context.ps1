# SessionStart hook: inject the product context every session.
#
# Reads .claude/hooks/context/product-context.md and emits it as `additionalContext`,
# so every session leads with the product vision (CLAUDE.md: "lead with product vision,
# not tech"). Edit that .md to change what's injected — this script just relays it.
#
# Fails OPEN (emits nothing) on any problem so a hook bug never blocks a session start.

$ErrorActionPreference = 'Stop'

try {
    $path = Join-Path $PSScriptRoot 'context/product-context.md'
    if (-not (Test-Path $path)) { exit 0 }
    $text = Get-Content $path -Raw
    if ([string]::IsNullOrWhiteSpace($text)) { exit 0 }
}
catch { exit 0 }

$payload = [ordered]@{
    hookSpecificOutput = [ordered]@{
        hookEventName     = 'SessionStart'
        additionalContext = $text
    }
}

$payload | ConvertTo-Json -Depth 5 -Compress
exit 0
