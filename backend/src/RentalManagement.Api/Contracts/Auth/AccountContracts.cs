namespace RentalManagement.Api.Contracts.Auth;

public sealed record SignupRequest(string? Email, string? Password, string? Role);
public sealed record AccountResponse(Guid Id, string Email, string Role);
public sealed record CurrentAccountResponse(Guid Id, string Email, string Role, Guid EnvironmentGeneration);
