using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/applications/{id:guid}")]
[Authorize(Policy = AccountRoles.PropertyManager)]
[Tags("Application reviews")]
[ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(void), StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
public sealed class ApplicationReviewsController(ApplicationService applications) : ControllerBase
{
    [HttpPost("start-review")]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    public async Task<ActionResult<ApplicationDetailResponse>> StartReview(Guid id, ApplicationActionRequest request, CancellationToken ct) =>
        Ok(await applications.ActAsync(User, id, ApplicationAction.StartReview, request, ct));

    [HttpPost("release")]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Release(Guid id, ApplicationActionRequest request, CancellationToken ct) =>
        Ok(await applications.ActAsync(User, id, ApplicationAction.Release, request, ct));

    [HttpPost("return")]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Return(Guid id, ApplicationActionRequest request, CancellationToken ct) =>
        Ok(await applications.ActAsync(User, id, ApplicationAction.Return, request, ct));

    [HttpPost("deny")]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Deny(Guid id, ApplicationActionRequest request, CancellationToken ct) =>
        Ok(await applications.ActAsync(User, id, ApplicationAction.Deny, request, ct));

    [HttpPost("approve")]
    [ProducesResponseType<ApplicationDetailResponse>(StatusCodes.Status200OK, "application/json")]
    public async Task<ActionResult<ApplicationDetailResponse>> Approve(Guid id, ApplicationActionRequest request, CancellationToken ct) =>
        Ok(await applications.ActAsync(User, id, ApplicationAction.Approve, request, ct));

    [HttpPut("my-note")]
    [ProducesResponseType<ManagerNoteResponse>(StatusCodes.Status200OK, "application/json")]
    public async Task<ActionResult<ManagerNoteResponse>> SaveNote(Guid id, SaveManagerNoteRequest request, CancellationToken ct) =>
        Ok(await applications.SaveNoteAsync(User, id, request, ct));
}
