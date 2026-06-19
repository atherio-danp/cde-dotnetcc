# Kommand templates ({{ProductName}})

Canonical skeletons. They encode the decisions: `Result<T>` returns, explicit constructors (no
primary ctors), correct Kommand namespaces, three-scope validation, interceptor-owned transactions.
Adjust names to the feature. **Kommand signatures verified against NuGet `Kommand` `1.0.0-alpha.1` (2026-06-19).**
Namespaces: `Kommand.Abstractions` = `ICommand`/`ICommandHandler`/`IQuery`/`IQueryHandler`/`IMediator`;
`Kommand` = `IValidator`/`ValidationResult`/`ValidationError`/`Unit`/interceptors. `Result`/`Error` shapes follow
`result-and-errors` + `docs/projectStandards/backend-architecture.md`.

> `using`s go **above** the file-scoped namespace (`csharp_using_directive_placement = outside_namespace` — build error otherwise).

## Command (`{{ProjectName}}.Application/Projects/Commands/CreateProjectCommand.cs`)
```csharp
using Kommand.Abstractions;
using {{ProjectName}}.Application.Projects.DTOs;
using {{ProjectName}}.Shared;

namespace {{ProjectName}}.Application.Projects.Commands;

public sealed record CreateProjectCommand(Guid TenantId, string Name) : ICommand<Result<ProjectResponse>>;
```

## Handler (`CreateProjectCommandHandler.cs`)
```csharp
using Kommand.Abstractions;
using {{ProjectName}}.Application.Projects; // IProjectRepository (cross-layer interface)
using {{ProjectName}}.Application.Projects.DTOs;
using {{ProjectName}}.Domain.Projects;
using {{ProjectName}}.Shared;

namespace {{ProjectName}}.Application.Projects.Commands;

public sealed class CreateProjectCommandHandler : ICommandHandler<CreateProjectCommand, Result<ProjectResponse>>
{
    private readonly IProjectRepository _projects;

    public CreateProjectCommandHandler(IProjectRepository projects)
    {
        _projects = projects ?? throw new ArgumentNullException(nameof(projects));
    }

    public async Task<Result<ProjectResponse>> HandleAsync(CreateProjectCommand command, CancellationToken cancellationToken)
    {
        try
        {
            Project project = Project.Create(command.TenantId, command.Name); // domain factory; may throw an invariant
            _projects.Add(project);                                          // change-tracking only; no SaveChanges
            return project.ToResponse();                                     // implicit T -> Result<ProjectResponse>
        }
        catch (DomainException ex)
        {
            return Error.Conflict(ex.Code, ex.Message);                      // implicit Error -> Result<ProjectResponse>
        }
    }
}
```

## Validator — business scope (`CreateProjectCommandValidator.cs`)
```csharp
using Kommand;                              // IValidator, ValidationResult, ValidationError live in Kommand
using {{ProjectName}}.Application.Projects; // IProjectRepository (cross-layer interface)

namespace {{ProjectName}}.Application.Projects.Commands;

public sealed class CreateProjectCommandValidator : IValidator<CreateProjectCommand>
{
    private readonly IProjectRepository _projects;

    public CreateProjectCommandValidator(IProjectRepository projects)
    {
        _projects = projects ?? throw new ArgumentNullException(nameof(projects));
    }

    public async Task<ValidationResult> ValidateAsync(CreateProjectCommand request, CancellationToken cancellationToken)
    {
        // Business rules that need data/understanding (e.g. uniqueness). Collect ALL errors, then return once.
        // Contract checks (required/shape) belong at the API; invariants belong in the domain.
        if (await _projects.NameExistsAsync(request.TenantId, request.Name, cancellationToken).ConfigureAwait(false))
        {
            // ErrorCode carries the stable error/i18n code (clients map it); ErrorMessage is a dev fallback.
            return ValidationResult.Failure([new ValidationError(nameof(request.Name), "Name already in use.", "project.name.duplicate")]);
        }

        return ValidationResult.Success();
    }
}
```

## Query (`{{ProjectName}}.Application/Projects/Queries/GetProjectQuery.cs` + handler)
```csharp
using Kommand.Abstractions;
using {{ProjectName}}.Application.Projects.DTOs;
using {{ProjectName}}.Shared;

namespace {{ProjectName}}.Application.Projects.Queries;

public sealed record GetProjectQuery(Guid TenantId, Guid ProjectId) : IQuery<Result<ProjectResponse>>;

public sealed class GetProjectQueryHandler : IQueryHandler<GetProjectQuery, Result<ProjectResponse>>
{
    private readonly IProjectReadRepository _read; // queries bypass write repos; project to DTOs, AsNoTracking

    public GetProjectQueryHandler(IProjectReadRepository read)
    {
        _read = read ?? throw new ArgumentNullException(nameof(read));
    }

    public async Task<Result<ProjectResponse>> HandleAsync(GetProjectQuery query, CancellationToken cancellationToken)
    {
        ProjectResponse? dto = await _read.GetAsync(query.TenantId, query.ProjectId, cancellationToken).ConfigureAwait(false);
        return dto is not null ? dto : Error.NotFound("project.not_found", "Project not found.");
    }
}
```

## Endpoint — single file (`{{ProjectName}}.Api/Features/Projects/CreateProject.cs`)
```csharp
using Kommand.Abstractions;
using {{ProjectName}}.Api.Endpoints;          // IEndpoint
using {{ProjectName}}.Api.Http;               // ToHttpResult
using {{ProjectName}}.Application.Projects.Commands;

namespace {{ProjectName}}.Api.Features.Projects;

public sealed record CreateProjectRequest(string Name);

public sealed class CreateProjectEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost("projects", async (CreateProjectRequest request, IMediator mediator, HttpContext http, CancellationToken ct) =>
        {
            // Contract scope only: shape is bound; authz inferred from http.User (no DB calls here).
            Guid tenantId = http.User.GetTenantId();
            Result<ProjectResponse> result = await mediator.SendAsync(new CreateProjectCommand(tenantId, request.Name), ct);
            return result.ToHttpResult(dto => TypedResults.Created($"/projects/{dto.Id}", dto));
        })
        .WithTags("Projects");
}
```
