# PreToolUse hook: force C# edits through Serena MCP.
#
# Denies native Edit / Write / MultiEdit on C# (.cs) files and tells the agent to use
# the Serena MCP tools instead (Serena gives symbolic navigation/editing for C#). All
# other file types — including the TypeScript/React frontend under apps/web — are left
# to the native tools by design (Serena's C# Roslyn LSP is the proven path here; the
# frontend moves fast and native edits are fine). Flip the $blocked list below to also
# cover .ts/.tsx if you later want Serena to own the frontend too.
#
# Reads the PreToolUse event JSON on stdin; emits a deny decision on stdout (exit 0).
# Fails open: any parse problem or missing path allows the call so the agent is never
# hard-blocked by a hook bug.

$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $event = $raw | ConvertFrom-Json
}
catch { exit 0 }

$path = $event.tool_input.file_path
if ([string]::IsNullOrWhiteSpace($path)) { exit 0 }

$ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
$blocked = @('.cs')
if ($blocked -notcontains $ext) { exit 0 }

$tool = $event.tool_name
$reason = @"
Native '$tool' on $ext files is disabled in this project — use the Serena MCP tools instead.
- Read / navigate: mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern.
- Edit by symbol (.cs): mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__insert_before_symbol.
- Fine-grained edits (any file): mcp__serena__replace_regex.
- Create or overwrite a file: mcp__serena__create_text_file.
Re-do this change through the appropriate Serena tool.
"@

$decision = [ordered]@{
    hookSpecificOutput = [ordered]@{
        hookEventName            = 'PreToolUse'
        permissionDecision       = 'deny'
        permissionDecisionReason = $reason
    }
}

$decision | ConvertTo-Json -Depth 5 -Compress
exit 0
