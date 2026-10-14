using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/properties")]
[Authorize(Policy = AccountRoles.PropertyManager)]
[Tags("Properties")]
[ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(void), StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
public sealed class PropertiesController(InventoryService inventory) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<InventoryPage<PropertyResponse>>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<InventoryPage<PropertyResponse>>> List(CancellationToken cancellationToken,
        [FromQuery] bool includeArchived = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await inventory.PropertiesAsync(User, includeArchived, page, pageSize, cancellationToken));

    [HttpPost]
    [ProducesResponseType<PropertyResponse>(StatusCodes.Status201Created, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<PropertyResponse>> Create(CreatePropertyRequest request, CancellationToken cancellationToken)
    {
        var response = await inventory.CreatePropertyAsync(User, request, cancellationToken);
        return Created($"/api/properties/{response.Id}", response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<PropertyResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<PropertyResponse>> Update(Guid id, UpdatePropertyRequest request,
        CancellationToken cancellationToken) => Ok(await inventory.UpdatePropertyAsync(User, id, request, cancellationToken));

    [HttpPost("{id:guid}/archive")]
    [ProducesResponseType<PropertyResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<PropertyResponse>> Archive(Guid id, ArchiveInventoryRequest request,
        CancellationToken cancellationToken) => Ok(await inventory.ArchivePropertyAsync(User, id, request, cancellationToken));
}
