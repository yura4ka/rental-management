namespace RentalManagement.Api.Domain;

public sealed class OperationReceipt
{
    public Guid AccountId { get; set; }
    public Guid OperationId { get; set; }
    public Guid EnvironmentGeneration { get; set; }
    public string CommandType { get; set; } = "";
    public string TargetType { get; set; } = "";
    public string TargetId { get; set; } = "";
    public int FingerprintVersion { get; set; } = 1;
    public byte[] RequestFingerprint { get; set; } = [];
    public string? Outcome { get; set; }
    public short? HttpStatus { get; set; }
    public string? Code { get; set; }
    public int? ResponseSchemaVersion { get; set; }
    public string? ResponseJson { get; set; }
    public DateTimeOffset? FinalizedAt { get; set; }
}

public sealed class LogoutAcknowledgement
{
    public Guid AccountId { get; set; }
    public Guid OperationId { get; set; }
    public DateTimeOffset AcknowledgedAt { get; set; }
}
