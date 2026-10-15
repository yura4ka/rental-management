using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Operations;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/units/{unitId:guid}/applications")]
[Authorize(Policy = AccountRoles.PropertyManager)]
[Tags("Application reviews")]
[ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(void), StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
public sealed class UnitApplicationsController(ApplicationService applications) : ControllerBase
{
    [HttpPost("reject-all")]
    [BusinessCommand("UnitApplications.RejectAll", Target = ResourceType.Unit, TargetId = IdSource.RouteUnitId,
        Scope = ResourceType.Unit, ScopeId = IdSource.RouteUnitId, Access = ResourceAccess.Owner)]
    [ProducesResponseType<RejectAllApplicationsResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<RejectAllApplicationsResponse>> RejectAll(Guid unitId, RejectAllApplicationsRequest request, CancellationToken ct) =>
        Ok(await applications.RejectAllAsync(User, unitId, request, ct));
}
