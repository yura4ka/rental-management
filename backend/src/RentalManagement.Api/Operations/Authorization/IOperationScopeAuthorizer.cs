namespace RentalManagement.Api.Operations.Authorization;

public interface IOperationScopeAuthorizer
{
    ResourceType ResourceType { get; }
    bool Supports(ResourceAccess access);
    Task CheckAsync(Guid accountId, AuthorizationScope scope, CancellationToken ct);
}
