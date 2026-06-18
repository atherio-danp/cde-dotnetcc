---
name: mcp-csharp
description: Create, debug, test, and publish MCP (Model Context Protocol) servers in C# using the official ModelContextProtocol SDK — tools/prompts/resources, stdio vs HTTP transport, MapMcp hosting. Use when building or changing an MCP server in the .NET backend (relevant to your agentic pipeline).
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol
---

# Building MCP servers in C# ({{ProductName}})

For exposing tools/capabilities over the Model Context Protocol from the .NET backend (your agentic pipeline
on Microsoft Agent Framework is the natural consumer/producer). C# (`.cs`) edits via **Serena**.

> **⚠ Approval required.** `ModelContextProtocol` (core) and `ModelContextProtocol.AspNetCore` (HTTP) plus the
> `Microsoft.McpServer.ProjectTemplates` template are NuGet dependencies — need **Dan's explicit approval**.

## Create
1. **Prereqs:** `dotnet --version` (need .NET 10+); `dotnet new install Microsoft.McpServer.ProjectTemplates`.
2. **Transport:** **stdio** (local CLI/IDE plugins, default) vs **HTTP** (cloud/web, multiple clients, containers).
3. **Scaffold:** stdio → `dotnet new mcpserver -n <Name>`; HTTP → `dotnet new web -n <Name>` + `dotnet add package ModelContextProtocol.AspNetCore`.
4. **Tools** — `[McpServerToolType]` on the class, `[McpServerTool]` + `[Description]` on the method, **a
   `[Description]` on EVERY parameter**, async tools take a `CancellationToken`:
   ```csharp
   [McpServerToolType]
   public static class ProjectTools
   {
       [McpServerTool, Description("Summarize a project.")]
       public static async Task<string> Summarize(
           [Description("The project id.")] Guid projectId,
           CancellationToken cancellationToken = default) => /* ... */;
   }
   ```
   For DI/non-static tools, use an **explicit constructor** assigning `readonly` fields — **NOT a primary
   constructor** (the upstream Microsoft sample uses `class ApiTools(HttpClient http, ILogger log)`; we don't).
5. **Prompts/Resources:** `[McpServerPromptType]`/`[McpServerPrompt]` (return `ChatMessage`);
   `[McpServerResourceType]`/`[McpServerResource(UriTemplate="config://app", MimeType="application/json")]`.
6. **Program.cs:**
   - **stdio:** `Host.CreateApplicationBuilder(args)`; **`builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace);`** — logging to **stdout corrupts JSON-RPC** (the #1 error); `AddMcpServer().WithStdioServerTransport().WithToolsFromAssembly();`
   - **HTTP:** `WebApplication.CreateBuilder(args)`; `AddMcpServer().WithHttpTransport().WithToolsFromAssembly()`; `app.MapMcp(); app.MapGet("/health", () => "ok");`
7. **Verify:** `dotnet build` / `dotnet run`.

## Debug / Test / Publish (lifecycle)
- **Debug:** run locally, validate via the **MCP Inspector** UI and Copilot Agent Mode; remember stdio logs go to stderr.
- **Test:** unit-test tools + integration-test via the MCP client SDK. *(The upstream skill uses Moq + FluentAssertions — both are libraries needing approval, and must match whatever test stack Dan approves for `apps/api/tests`.)*
- **Publish:** NuGet packaging for stdio servers; **Docker** containerization for HTTP servers → deploy to our
  **(EU) host's container runtime** (NOT Azure Container Apps / App Service — strip those). MCP Registry publish is optional.

## Ours
- Explicit constructors, no primary ctors; `.cs` via Serena; async + `CancellationToken` throughout.
- Tools that touch tenant data must carry the **tenancy invariant**; failures should flow through our `Result<T>`/error model where the tool contract allows.
- Pair with the **`otel-instrumentation`** skill — `transport-config` supports OpenTelemetry; trace tool calls.
- No library/template added without Dan's approval.
