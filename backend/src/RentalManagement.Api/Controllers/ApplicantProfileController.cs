using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/me/profile")]
[Authorize(Policy = AccountRoles.Applicant)]
[Tags("Applicant profile")]
[Produces("application/json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
public sealed class ApplicantProfileController(ApplicantProfileService profiles) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ApplicantProfileResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ApplicantProfileResponse>> Read(CancellationToken cancellationToken) =>
        Ok(await profiles.ReadAsync(User, cancellationToken));

    [HttpPut("applicant-information")]
    [ProducesResponseType<ApplicantProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<ApplicantProfileResponse>> ReplaceInformation(ApplicantInformationRequest request,
        CancellationToken cancellationToken) => Ok(await profiles.ReplaceInformationAsync(User, request, cancellationToken));

    [HttpPut("residence-history")]
    [ProducesResponseType<ApplicantProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<ApplicantProfileResponse>> ReplaceResidences(ResidenceHistoryRequest request,
        CancellationToken cancellationToken) => Ok(await profiles.ReplaceResidencesAsync(User, request, cancellationToken));
}
