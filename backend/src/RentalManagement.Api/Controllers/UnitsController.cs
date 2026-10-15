using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Operations;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/properties/{propertyId:guid}/units")]
[Authorize(Policy = AccountRoles.PropertyManager)]
[Tags("Units")]
[ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(void), StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError, "application/problem+json")]
public sealed class UnitsController(InventoryService inventory) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<InventoryPage<UnitResponse>>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<InventoryPage<UnitResponse>>> List(Guid propertyId, CancellationToken cancellationToken,
        [FromQuery] bool includeArchived = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await inventory.UnitsAsync(User, propertyId, includeArchived, page, pageSize, cancellationToken));

    [HttpPost]
    [BusinessCommand("Units.Create", Target = ResourceType.Unit, TargetId = IdSource.RequestId,
        Scope = ResourceType.Property, ScopeId = IdSource.RoutePropertyId, Access = ResourceAccess.Owner,
        AcceptedScope = ResourceType.Unit, AcceptedScopeId = IdSource.RequestId, AcceptedAccess = ResourceAccess.Owner)]
    [ProducesResponseType<UnitResponse>(StatusCodes.Status201Created, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<UnitResponse>> Create(Guid propertyId, CreateUnitRequest request,
        CancellationToken cancellationToken)
    {
        var response = await inventory.CreateUnitAsync(User, propertyId, request, cancellationToken);
        return Created($"/api/properties/{propertyId}/units/{response.Id}", response);
    }

    [HttpPut("{id:guid}")]
    [BusinessCommand("Units.Update", Target = ResourceType.Unit, TargetId = IdSource.RouteId,
        Scope = ResourceType.Property, ScopeId = IdSource.RoutePropertyId, Access = ResourceAccess.Owner)]
    [ProducesResponseType<UnitResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<UnitResponse>> Update(Guid propertyId, Guid id, UpdateUnitRequest request,
        CancellationToken cancellationToken) => Ok(await inventory.UpdateUnitAsync(User, propertyId, id, request, cancellationToken));

    [HttpPost("{id:guid}/archive")]
    [BusinessCommand("Units.Archive", Target = ResourceType.Unit, TargetId = IdSource.RouteId,
        Scope = ResourceType.Property, ScopeId = IdSource.RoutePropertyId, Access = ResourceAccess.Owner)]
    [ProducesResponseType<UnitResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<UnitResponse>> Archive(Guid propertyId, Guid id, ArchiveInventoryRequest request,
        CancellationToken cancellationToken) => Ok(await inventory.ArchiveUnitAsync(User, propertyId, id, request, cancellationToken));
}
