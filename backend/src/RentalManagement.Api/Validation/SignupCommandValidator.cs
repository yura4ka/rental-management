using System.ComponentModel.DataAnnotations;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Services.Auth;

namespace RentalManagement.Api.Validation;

public sealed class SignupCommandValidator : AbstractValidator<SignupCommand>
{
    public SignupCommandValidator(ILookupNormalizer normalizer)
    {
        const string emailMessage = "Supply a valid email of at most 256 UTF-16 code units.";
        const string passwordMessage = "Use 12–128 UTF-16 code units, not only whitespace.";

        RuleFor(command => command.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage(emailMessage)
            .MaximumLength(256).WithMessage(emailMessage)
            // Retain the same email syntax check used by Identity's UserValidator.
            .Must(email => new EmailAddressAttribute().IsValid(email)).WithMessage(emailMessage)
            .Must(email => normalizer.NormalizeEmail(email).Length <= 256 &&
                           normalizer.NormalizeName(email).Length <= 256).WithMessage(emailMessage)
            .OverridePropertyName("email");

        RuleFor(command => command.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage(passwordMessage)
            .Length(12, 128).WithMessage(passwordMessage)
            .OverridePropertyName("password");

        RuleFor(command => command.Role)
            .Must(AccountRoles.IsAllowed).WithMessage("Choose Applicant or PropertyManager.")
            .OverridePropertyName("role");
    }
}
