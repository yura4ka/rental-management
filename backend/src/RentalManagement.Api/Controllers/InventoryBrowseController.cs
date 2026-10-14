using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
[Tags("Inventory browsing")]
[ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(void), StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
public sealed class InventoryBrowseController(InventoryService inventory) : ControllerBase
{
    [HttpGet("available-units")]
    [ProducesResponseType<InventoryPage<AvailableUnitResponse>>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<InventoryPage<AvailableUnitResponse>>> Available(CancellationToken cancellationToken,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await inventory.AvailableAsync(page, pageSize, cancellationToken));

    [HttpGet("unit-types")]
    [ProducesResponseType<IReadOnlyList<UnitTypeResponse>>(StatusCodes.Status200OK, "application/json")]
    public async Task<ActionResult<IReadOnlyList<UnitTypeResponse>>> Types(CancellationToken cancellationToken) =>
        Ok(await inventory.TypesAsync(cancellationToken));
}
