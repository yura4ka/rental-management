using FluentValidation.Results;
using RentalManagement.Api.Infrastructure;

namespace RentalManagement.Api.Validation;

public static class ValidationErrors
{
    public static void ThrowIfInvalid(params ValidationResult[] results)
    {
        var fields = results.SelectMany(result => result.Errors)
            .GroupBy(error => error.PropertyName, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().ErrorMessage, StringComparer.Ordinal);
        if (fields.Count != 0)
            throw new ApiException(422, "ValidationFailed", "Validation failed.", fields);
    }
}
