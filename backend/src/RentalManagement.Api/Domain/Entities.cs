namespace RentalManagement.Api.Domain;

public sealed class Property
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid OwnerManagerId { get; set; }
    public Address Address { get; set; } = new();
    public DateTimeOffset? ArchivedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class UnitType
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsActive { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class Unit
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid PropertyId { get; set; }
    public Guid UnitTypeId { get; set; }
    public string Number { get; set; } = "";
    public int Bedrooms { get; set; }
    public decimal MonthlyRent { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class UnitLeaseGuard
{
    public Guid UnitId { get; set; }
    public DateOnly? ConfirmedLeaseEndExclusive { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class ApplicantProfile
{
    public Guid ApplicantId { get; set; }
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? ContactEmail { get; set; }
    public Address CurrentAddress { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class ProfileResidence
{
    public Guid ApplicantId { get; set; }
    public int Position { get; set; }
    public Address Address { get; set; } = new();
    public string LandlordName { get; set; } = "";
    public string LandlordPhone { get; set; } = "";
    public DateOnly MoveInDate { get; set; }
    public DateOnly MoveOutDate { get; set; }
}

public enum ApplicationStatus { Draft, Submitted, InReview, Returned, Approved, Denied, Withdrawn }
public enum ApplicationAction { Create, Submit, StartReview, Release, Return, Deny, Approve, Withdraw }

public sealed class RentalApplication
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid ApplicantId { get; set; }
    public Guid UnitId { get; set; }
    public ApplicationStatus Status { get; set; }
    public string ApplicantName { get; set; } = "";
    public string ApplicantPhone { get; set; } = "";
    public string ContactEmail { get; set; } = "";
    public Address CurrentAddress { get; set; } = new();
    public DateTimeOffset ApplicantInformationSavedAt { get; set; }
    public DateTimeOffset? ResidenceHistorySavedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset StatusChangedAt { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class ApplicationResidence
{
    public Guid ApplicationId { get; set; }
    public int Position { get; set; }
    public Address Address { get; set; } = new();
    public string LandlordName { get; set; } = "";
    public string LandlordPhone { get; set; } = "";
    public DateOnly MoveInDate { get; set; }
    public DateOnly MoveOutDate { get; set; }
}

public sealed class ApplicationStatusHistory
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid ApplicationId { get; set; }
    public long Sequence { get; set; }
    public Guid ActorUserId { get; set; }
    public Guid OperationId { get; set; }
    public ApplicationAction Action { get; set; }
    public ApplicationStatus? FromStatus { get; set; }
    public ApplicationStatus ToStatus { get; set; }
    public string? Comment { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
}

public sealed class ManagerNote
{
    public Guid ApplicationId { get; set; }
    public Guid AuthorManagerId { get; set; }
    public string Body { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long Version { get; set; } = 1;
}

public sealed class Lease
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid ApplicationId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDateExclusive { get; set; }
    public DateTimeOffset ApprovedAt { get; set; }
}

public sealed class DatabaseMetadata
{
    public byte SingletonId { get; set; } = 1;
    public Guid EnvironmentGeneration { get; set; }
    public DateTimeOffset InitializedAt { get; set; }
}
