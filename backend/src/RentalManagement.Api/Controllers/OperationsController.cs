using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Operations;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/operations")]
[Authorize]
[Tags("Operations")]
[ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(void), StatusCodes.Status403Forbidden)]
public sealed class OperationsController(CommandRunner commands) : ControllerBase
{
    [HttpGet("{operationId:guid}")]
    [ProducesResponseType<OperationRecoveryResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<OperationRecoveryResponse>> Get(Guid operationId,
        [FromQuery] Guid environmentGeneration, CancellationToken ct) =>
        Ok(await commands.RecoverAsync(User, operationId, environmentGeneration, ct));
}
