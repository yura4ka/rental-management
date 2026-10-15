using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Auth;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Services.Auth;
using RentalManagement.Api.Validation;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Operations;

namespace RentalManagement.Api.Services;

public sealed class AccountService(ApplicationDbContext db, UserManager<IdentityUser<Guid>> users,
    IValidator<SignupRequest> requestValidator, IValidator<SignupCommand> commandValidator)
{
    public async Task<AccountResponse> SignupAsync(SignupRequest request, CancellationToken cancellationToken)
    {
        var requestValidation = await requestValidator.ValidateAsync(request, cancellationToken);
        var command = SignupCommand.FromRequest(request);
        var commandValidation = await commandValidator.ValidateAsync(command, cancellationToken);
        ValidationErrors.ThrowIfInvalid(requestValidation, commandValidation);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var user = new IdentityUser<Guid>
        {
            Id = Guid.CreateVersion7(), Email = command.Email, UserName = command.Email
        };
        try
        {
            RequireSuccess(await users.CreateAsync(user, command.Password));
            RequireSuccess(await users.AddToRoleAsync(user, command.Role));
            if (command.Role == AccountRoles.Applicant)
                db.ApplicantProfiles.Add(new ApplicantProfile { ApplicantId = user.Id });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new AccountResponse(user.Id, user.Email, command.Role);
        }
        catch (DbUpdateException exception) when (IsDuplicateEmail(exception))
        {
            throw new ApiException(422, "EmailAlreadyRegistered", "Email is already registered.",
                new Dictionary<string, string> { ["email"] = "Email is already registered." });
        }
    }

    public async Task<CurrentAccountResponse> MeAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var user = await GetUserAsync(principal);
        var roles = await users.GetRolesAsync(user);
        if (roles.Count != 1 || !AccountRoles.IsAllowed(roles[0]))
            throw new ApiException(500, "AccountRoleInvalid", "Account configuration is invalid.");
        var generation = await db.DatabaseMetadata.AsNoTracking().Where(m => m.SingletonId == 1)
            .Select(m => (Guid?)m.EnvironmentGeneration).SingleOrDefaultAsync(cancellationToken);
        if (generation is null)
            throw new ApiException(503, "DatabaseNotInitialized", "Database initialization is required.");
        return new CurrentAccountResponse(user.Id, user.Email!, roles[0], generation.Value);
    }

    public async Task<LogoutResponse> LogoutAsync(ClaimsPrincipal principal, Guid operationId, CancellationToken ct)
    {
        CommandRunner.RequireUuid7(operationId, "operationId");
        var account = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            // Serialize all logout IDs for an account as well as identical retries.
            await CommandRunner.AcquireLockAsync(db, $"logout:{account:D}", ct);
            var existing = await db.LogoutAcknowledgements.AsNoTracking()
                .SingleOrDefaultAsync(a => a.AccountId == account && a.OperationId == operationId, ct);
            if (existing is not null) return new(operationId, "Accepted", existing.AcknowledgedAt);
            var user = await GetUserAsync(principal);
            var result = await users.UpdateSecurityStampAsync(user);
            if (!result.Succeeded)
                throw new ApiException(503, "LogoutUnavailable", "Sign out could not be completed. Retry.");
            var acknowledgement = new LogoutAcknowledgement
            {
                AccountId = account, OperationId = operationId, AcknowledgedAt = DateTimeOffset.UtcNow
            };
            db.LogoutAcknowledgements.Add(acknowledgement);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return new(operationId, "Accepted", acknowledgement.AcknowledgedAt);
        }
        catch (Exception exception) when (exception is SqlException { Number: -2 or 1205 or 1222 or 51000 } ||
            exception.InnerException is SqlException { Number: -2 or 1205 or 1222 or 51000 })
        {
            throw new ApiException(503, "LogoutUnavailable", "Sign out could not be completed. Retry identically.");
        }
    }

    public async Task<LogoutResponse> RecoverLogoutAsync(ClaimsPrincipal principal, Guid operationId, CancellationToken ct)
    {
        CommandRunner.RequireUuid7(operationId, "operationId");
        var user = await GetUserAsync(principal);
        var existing = await db.LogoutAcknowledgements.AsNoTracking()
            .SingleOrDefaultAsync(a => a.AccountId == user.Id && a.OperationId == operationId, ct);
        return existing is null ? new(operationId, "Unknown") : new(operationId, "Accepted", existing.AcknowledgedAt);
    }

    private async Task<IdentityUser<Guid>> GetUserAsync(ClaimsPrincipal principal) =>
        await users.GetUserAsync(principal) ?? throw new ApiException(401, "Unauthenticated", "Authentication required.");

    private static void RequireSuccess(IdentityResult result)
    {
        if (result.Succeeded) return;
        var errors = result.Errors.ToArray();
        if (errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName"))
            throw new ApiException(422, "EmailAlreadyRegistered", "Email is already registered.",
                new Dictionary<string, string> { ["email"] = "Email is already registered." });
        // Do not expose Identity's messages: some include the supplied email/user name.
        throw new ApiException(422, "ValidationFailed", "Account could not be created.");
    }

    private static bool IsDuplicateEmail(DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: 2601 or 2627 } sql &&
        (sql.Message.Contains("EmailIndex", StringComparison.Ordinal) ||
         sql.Message.Contains("UserNameIndex", StringComparison.Ordinal));
}
