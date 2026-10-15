using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Operations;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/applications")]
[Authorize]
[Tags("Applications")]
[ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(void), StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
public sealed class ApplicationsController(ApplicationService applications) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    [ProducesResponseType<ApplicationPage>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<ApplicationPage>> List([FromQuery] ApplicationListQuery query, CancellationToken ct) =>
        Ok(await applications.ListAsync(User, query, ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Read(Guid id, CancellationToken ct) =>
        Ok(await applications.ReadAsync(User, id, ct));

    [HttpPost]
    [BusinessCommand("Applications.Create", Target = ResourceType.Application, TargetId = IdSource.RequestId,
        Scope = ResourceType.Unit, ScopeId = IdSource.RequestUnitId, Access = ResourceAccess.Applicant,
        AcceptedScope = ResourceType.Application, AcceptedScopeId = IdSource.RequestId, AcceptedAccess = ResourceAccess.Applicant)]
    [Authorize(Policy = AccountRoles.Applicant)]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status201Created, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Create(CreateApplicationRequest request, CancellationToken ct)
    {
        var response = await applications.CreateAsync(User, request, ct);
        return CreatedAtAction(nameof(Read), new { id = response.Application.Id }, response);
    }

    [HttpPut("{id:guid}/applicant-information")]
    [BusinessCommand("Applications.SaveInformation", Target = ResourceType.Application, TargetId = IdSource.RouteId,
        Scope = ResourceType.Application, ScopeId = IdSource.RouteId, Access = ResourceAccess.Applicant)]
    [Authorize(Policy = AccountRoles.Applicant)]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<ApplicationDetailResponse>> SaveInformation(Guid id, ApplicantInformationRequest request, CancellationToken ct) =>
        Ok(await applications.SaveInformationAsync(User, id, request, ct));

    [HttpPut("{id:guid}/residence-history")]
    [BusinessCommand("Applications.SaveResidences", Target = ResourceType.Application, TargetId = IdSource.RouteId,
        Scope = ResourceType.Application, ScopeId = IdSource.RouteId, Access = ResourceAccess.Applicant)]
    [Authorize(Policy = AccountRoles.Applicant)]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<ApplicationDetailResponse>> SaveResidences(Guid id, ResidenceHistoryRequest request, CancellationToken ct) =>
        Ok(await applications.SaveResidencesAsync(User, id, request, ct));

    [HttpPost("{id:guid}/submit")]
    [BusinessCommand("Applications.Submit", Target = ResourceType.Application, TargetId = IdSource.RouteId,
        Scope = ResourceType.Application, ScopeId = IdSource.RouteId, Access = ResourceAccess.Applicant)]
    [Authorize(Policy = AccountRoles.Applicant)]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Submit(Guid id, ApplicationActionRequest request, CancellationToken ct) =>
        Ok(await applications.ActAsync(User, id, ApplicationAction.Submit, request, ct));

    [HttpPost("{id:guid}/withdraw")]
    [BusinessCommand("Applications.Withdraw", Target = ResourceType.Application, TargetId = IdSource.RouteId,
        Scope = ResourceType.Application, ScopeId = IdSource.RouteId, Access = ResourceAccess.Applicant)]
    [Authorize(Policy = AccountRoles.Applicant)]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Withdraw(Guid id, ApplicationActionRequest request, CancellationToken ct) =>
        Ok(await applications.ActAsync(User, id, ApplicationAction.Withdraw, request, ct));
}
