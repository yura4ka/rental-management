using RentalManagement.Api.Contracts.Auth;

namespace RentalManagement.Api.Services.Auth;

public sealed record SignupCommand(string Email, string Password, string Role)
{
    public static SignupCommand FromRequest(SignupRequest request) => new(
        Email: request.Email?.Trim() ?? "",
        Password: request.Password ?? "",
        Role: request.Role ?? "");
}
