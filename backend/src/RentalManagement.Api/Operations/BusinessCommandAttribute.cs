using System.Text.Json.Serialization;

namespace RentalManagement.Api.Operations;

// Names are persisted in receipt JSON/fingerprints. Renaming them requires a compatibility strategy.
[JsonConverter(typeof(JsonStringEnumConverter<ResourceType>))]
public enum ResourceType { Unspecified, Account, Property, Unit, Profile, Application, ManagerNote }

[JsonConverter(typeof(JsonStringEnumConverter<ResourceAccess>))]
public enum ResourceAccess { Unspecified, Applicant, Manager, Owner }

public enum IdSource { Unspecified, Account, RouteId, RoutePropertyId, RouteUnitId, RequestId, RequestUnitId }

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
public sealed class BusinessCommandAttribute(string commandType) : Attribute
{
    public string CommandType { get; } = commandType;
    public ResourceType Target { get; set; }
    public IdSource TargetId { get; set; }
    public ResourceType Scope { get; set; }
    public IdSource ScopeId { get; set; }
    public ResourceAccess Access { get; set; }

    // Omit all three to retain the initial scope. Creates normally authorize against the new resource on recovery.
    public ResourceType AcceptedScope { get; set; }
    public IdSource AcceptedScopeId { get; set; }
    public ResourceAccess AcceptedAccess { get; set; }

    internal void Validate()
    {
        if (string.IsNullOrWhiteSpace(CommandType) || CommandType.Length > 100 ||
            !Specified(Target) || !Specified(TargetId) || !Specified(Scope) || !Specified(ScopeId) || !Specified(Access))
            throw new InvalidOperationException("Business command metadata must declare its stable name, target and authorization scope.");

        var hasAcceptedScope = AcceptedScope != ResourceType.Unspecified ||
            AcceptedScopeId != IdSource.Unspecified || AcceptedAccess != ResourceAccess.Unspecified;
        if (hasAcceptedScope && (!Specified(AcceptedScope) || !Specified(AcceptedScopeId) || !Specified(AcceptedAccess)))
            throw new InvalidOperationException("Accepted receipt authorization must declare a complete scope.");
    }

    private static bool Specified<T>(T value) where T : struct, Enum =>
        !value.Equals(default(T)) && Enum.IsDefined(value);
}
