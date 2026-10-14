using FluentValidation;
using RentalManagement.Api.Contracts.Auth;

namespace RentalManagement.Api.Validation;

public sealed class SignupRequestValidator : AbstractValidator<SignupRequest>
{
    public SignupRequestValidator()
    {
        // Evaluate the supplied length before mapping can remove surrounding whitespace.
        RuleFor(request => request.Email)
            .MaximumLength(256)
            .WithMessage("Supply a valid email of at most 256 UTF-16 code units.")
            .OverridePropertyName("email");
    }
}
