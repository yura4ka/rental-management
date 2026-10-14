using Microsoft.AspNetCore.Identity;

namespace RentalManagement.Api.Auth;

public sealed class PasswordValidator : IPasswordValidator<IdentityUser<Guid>>
{
    public Task<IdentityResult> ValidateAsync(UserManager<IdentityUser<Guid>> manager,
        IdentityUser<Guid> user, string? password)
    {
        var valid = password is { Length: >= 12 and <= 128 } && !string.IsNullOrWhiteSpace(password);
        return Task.FromResult(valid ? IdentityResult.Success : IdentityResult.Failed(new IdentityError
        {
            Code = "InvalidPassword",
            Description = "Use 12–128 UTF-16 code units, not only whitespace."
        }));
    }
}
