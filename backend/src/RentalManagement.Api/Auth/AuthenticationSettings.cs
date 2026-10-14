namespace RentalManagement.Api.Auth;

public sealed class AuthenticationSettings
{
    public int AccessTokenMinutes { get; init; } = 15;
    public int RefreshTokenDays { get; init; } = 14;
}
