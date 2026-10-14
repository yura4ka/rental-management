namespace RentalManagement.Api.Infrastructure;

public sealed class ApiException(int status, string code, string title,
    IReadOnlyDictionary<string, string>? fields = null) : Exception(title)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public string Title { get; } = title;
    public IReadOnlyDictionary<string, string>? Fields { get; } = fields;
}
