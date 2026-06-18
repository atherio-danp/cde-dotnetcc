# Kommand templates ({{ProductName}})

Canonical skeletons. They encode the decisions: `Result<T>` returns, explicit constructors (no
primary ctors), `using Kommand.Abstractions;`, three-scope validation, interceptor-owned transactions.
Adjust names to the feature. *(`Result`/`Error`/`IValidator`/`IMediator` member shapes follow
`docs/projectStandards/backend-architecture.md`; verify the exact Kommand signatures against the library
when scaffolding — it is Dan's library and the published guide diverges from older code.)*

## Command (`{{ProjectName}}.Application/Projects/Commands/CreateProjectCommand.cs`)
```csharp
namespace {{ProjectName}}.Application.Projects.Commands;

using Kommand.Abstractions;
using {{ProjectName}}.Application.Projects.DTOs;
using {{ProjectName}}.Shared;

public sealed record CreateProjectCommand(Guid TenantId, string Name) : ICommand<Result<ProjectResponse>>;
```

## Handler (`CreateProjectCommandHandler.cs`)
```csharp
namespace {{ProjectName}}.Application.Projects.Commands;

using Kommand.Abstractions;
using {{ProjectName}}.Application.Projects; // IProjectRepository (cross-layer interface)
using {{ProjectName}}.Application.Projects.DTOs;
using {{ProjectName}}.Domain.Projects;
using {{ProjectName}}.Shared;

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
namespace {{ProjectName}}.Application.Projects.Commands;

using Kommand.Abstractions;

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
            return ValidationResult.Failure([new ValidationError(nameof(request.Name), "Name already in use.")]);
        }

        return ValidationResult.Success();
    }
}
```

## Query (`{{ProjectName}}.Application/Projects/Queries/GetProjectQuery.cs` + handler)
```csharp
namespace {{ProjectName}}.Application.Projects.Queries;

using Kommand.Abstractions;
using {{ProjectName}}.Application.Projects.DTOs;
using {{ProjectName}}.Shared;

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
namespace {{ProjectName}}.Api.Features.Projects;

using Kommand.Abstractions;
using {{ProjectName}}.Api.Endpoints;          // IEndpoint
using {{ProjectName}}.Api.Http;               // ToHttpResult
using {{ProjectName}}.Application.Projects.Commands;

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
