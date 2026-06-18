# PreToolUse hook: gate destructive shell commands.
#
# Project posture: permissions broadly ALLOW tools, so safe work never prompts (cd,
# dotnet build/run/test, npm, web search, reads, git status/add/commit, ...). This hook
# is the gate that escalates DESTRUCTIVE commands:
#   * ASK  — force a permission prompt for recoverable-but-destructive actions (ANY file
#            deletion, history rewrites, discarding work, dropping data).
#   * DENY — hard-block the truly catastrophic (wiping / or ~).
# A hook "ask"/"deny" overrides a broad "allow" rule, which is why safe commands stay
# silent while these prompt. Matches Bash and PowerShell tool calls.
#
# Reads the PreToolUse event JSON on stdin; emits the decision on stdout (exit 0).
# Fails OPEN on any parse problem so a hook bug never hard-blocks legitimate work.

$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $event = $raw | ConvertFrom-Json
}
catch { exit 0 }

$command = [string]$event.tool_input.command
if ([string]::IsNullOrWhiteSpace($command)) { exit 0 }

$norm = ($command -replace '\s+', ' ').Trim()

function Send-Decision {
    param([string]$Decision, [string]$Reason)
    $payload = [ordered]@{
        hookSpecificOutput = [ordered]@{
            hookEventName            = 'PreToolUse'
            permissionDecision       = $Decision
            permissionDecisionReason = $Reason
        }
    }
    $payload | ConvertTo-Json -Depth 5 -Compress
    exit 0
}

# --- DENY: catastrophic, never legitimate (checked first) ---
if ($norm -match '(?i)\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+(/|~|/\*|\$HOME)(\s|$)') {
    Send-Decision 'deny' 'Refusing rm -rf of / or ~ (catastrophic). Run it yourself if you truly intend it.'
}

# --- ASK: destructive but recoverable — force a prompt ---
$askRules = @(
    @{ Pattern = '(?i)\brm\s';                                     Reason = 'file/directory deletion (rm)' }
    @{ Pattern = '(?i)\brmdir\s';                                  Reason = 'directory deletion (rmdir)' }
    @{ Pattern = '(?i)\bRemove-Item\b';                            Reason = 'file/directory deletion (Remove-Item)' }
    @{ Pattern = '(?i)(^|[|;&]\s*)(del|rd|erase)\s';               Reason = 'file/directory deletion (del/rd)' }
    @{ Pattern = '(?i)\bgit\s+push\b[^|;&]*--force(?!-with-lease)'; Reason = 'git push --force (rewrites shared history)' }
    @{ Pattern = '(?i)\bgit\s+reset\s+--hard\b';                   Reason = 'git reset --hard (discards uncommitted work)' }
    @{ Pattern = '(?i)\bgit\s+clean\b[^|;&]*-[a-z]*f';             Reason = 'git clean -f (deletes untracked files)' }
    @{ Pattern = '(?i)\bgit\s+add\b';                             Reason = 'git add (staging — confirm per governance)' }
    @{ Pattern = '(?i)\bgit\s+commit\b';                          Reason = 'git commit (confirm per governance)' }
    @{ Pattern = '(?i)\bgit\s+push\b';                            Reason = 'git push (confirm per governance)' }
    @{ Pattern = '(?i)\bdotnet\s+ef\s+database\s+drop\b';          Reason = 'dotnet ef database drop' }
    @{ Pattern = '(?i)\bdotnet\s+ef\s+migrations\s+remove\b';      Reason = 'dotnet ef migrations remove' }
    @{ Pattern = '(?i)\bDROP\s+(DATABASE|SCHEMA|TABLE)\b';         Reason = 'SQL DROP DATABASE/SCHEMA/TABLE' }
    @{ Pattern = '(?i)\bTRUNCATE\b';                               Reason = 'SQL TRUNCATE' }
)
foreach ($r in $askRules) {
    if ($norm -match $r.Pattern) {
        Send-Decision 'ask' "Confirm destructive action: $($r.Reason)."
    }
}

# Unqualified DELETE / UPDATE (no WHERE) — heuristic SQL guard.
if ($norm -match '(?i)\bDELETE\s+FROM\b' -and $norm -notmatch '(?i)\bWHERE\b') {
    Send-Decision 'ask' 'Confirm destructive action: SQL DELETE without WHERE.'
}
if ($norm -match '(?i)\bUPDATE\b[^;]*\bSET\b' -and $norm -notmatch '(?i)\bWHERE\b') {
    Send-Decision 'ask' 'Confirm destructive action: SQL UPDATE without WHERE.'
}

exit 0
