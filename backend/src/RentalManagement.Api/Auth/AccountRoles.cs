namespace RentalManagement.Api.Auth;

public static class AccountRoles
{
    public const string Applicant = "Applicant";
    public const string PropertyManager = "PropertyManager";

    public static bool IsAllowed(string? role) => role is Applicant or PropertyManager;
}
