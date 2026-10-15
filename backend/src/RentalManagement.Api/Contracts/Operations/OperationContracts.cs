using System.Text.Json;
using System.Text.Json.Serialization;

namespace RentalManagement.Api.Contracts.Operations;

public interface ICreateResourceRequest
{
    Guid Id { get; }
}

public interface IUnitTargetRequest
{
    Guid UnitId { get; }
}

public abstract record OperationRequest
{
    [JsonRequired]
    public Guid OperationId { get; init; }
    [JsonRequired]
    public Guid EnvironmentGeneration { get; init; }
}

public sealed record AffectedResource(string ResourceType, string Id, string? Version);
public sealed record OperationRecoveryResponse(Guid OperationId, string Outcome, int? HttpStatus = null,
    JsonElement? Response = null, int? ResponseSchemaVersion = null);
public sealed record LogoutRequest([property: JsonRequired] Guid OperationId);
public sealed record LogoutResponse(Guid OperationId, string Outcome, DateTimeOffset? AcknowledgedAt = null);
