# Backend agent instructions

## Scope and architecture

These instructions apply to `backend/`. Follow [`../docs/specs/backend-architecture.md`](../docs/specs/backend-architecture.md) for architectural and behavioral requirements. Keep changes consistent with nearby code and scoped to the requested task.

## Routes, controllers, and annotations

- Group business routes under `/api` in feature-specific, thin controllers inheriting directly from `ControllerBase`; keep business rules and transactions in services. Use controller-level `[ApiController]`, `[Route]`, `[Authorize]` (with role policies where needed), and `[Tags]`, with HTTP methods and relative routes on actions.
- Put shared response annotations on the controller and operation-specific responses on actions; document only supported statuses. Use typed `ProducesResponseType<T>` with explicit `application/json` for success and `ProblemDetails` with `application/problem+json` for business errors. Avoid controller-level `[Produces("application/json")]`, which overrides error media types in generated metadata.
- Document standard Bearer 401/403 responses with `[ProducesResponseType(typeof(void), statusCode)]` so conventions do not infer a body. Preserve native Identity login/refresh behavior, and verify response statuses, schemas, and media types in OpenAPI tests.

## Verification

Run commands from `backend/`. Use the pinned SDK and local EF tooling.

```bash
dotnet tool restore
dotnet restore RentalManagement.sln
dotnet build RentalManagement.sln
dotnet test tests/RentalManagement.UnitTests
```

For EF model changes, also check migration coverage:

```bash
dotnet ef migrations has-pending-model-changes --project src/RentalManagement.Api --startup-project src/RentalManagement.Api
```

Do not start Docker or enable database-dependent tests without authorization.
Integration tests require `RENTAL_TEST_SQLSERVER` and create/drop databases:

```bash
dotnet test tests/RentalManagement.IntegrationTests
```

Report which checks ran and any blockers; do not claim unrun checks passed.

## C# formatting

- Follow surrounding code and use four-space indentation.
- Break long fluent chains than leaving a long expression on one line.
- Separate logical blocks with line breaks to make core more readable.
- Keep related ordering calls together when readable; otherwise wrap them.
- Indent continuation lines one level beyond the statement.
- Limit formatting changes to files touched by the task.

Preferred layout:

```csharp
var rows = await db.ProfileResidences.AsNoTracking()
    .Where(r => r.ApplicantId == profile.ApplicantId)
    .OrderBy(r => r.MoveInDate).ThenBy(r => r.MoveOutDate).ThenBy(r => r.Position)
    .ToListAsync(cancellationToken);
```
