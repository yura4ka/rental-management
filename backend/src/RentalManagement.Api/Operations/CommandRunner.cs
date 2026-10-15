using System.Diagnostics;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;

namespace RentalManagement.Api.Operations;

public sealed class CommandRunner(ApplicationDbContext db, OperationAuthorization authorization,
    IOptions<JsonOptions> options, TimeProvider clock, ILogger<CommandRunner> logger)
{
    private JsonSerializerOptions Json => options.Value.JsonSerializerOptions;

    public async Task<IActionResult> ExecuteAsync(ClaimsPrincipal principal, CommandDescriptor command,
        OperationRequest request, JsonElement body, Func<Task<IActionResult>> execute, CancellationToken ct)
    {
        RequireUuid7(request.OperationId, "operationId");
        if (request.EnvironmentGeneration == Guid.Empty)
            throw new ApiException(400, "MalformedRequest", "Supply environmentGeneration.");
        var account = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var fingerprint = CommandFingerprint.Compute(command.CommandType, command.TargetType, command.TargetId, command.Route, body);
        var started = Stopwatch.GetTimestamp();
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await CheckGenerationAsync(request.EnvironmentGeneration, ct);
            await AcquireLockAsync(db, $"operation:{account:D}:{request.OperationId:D}", ct);
            var existing = await db.OperationReceipts.AsNoTracking()
                .SingleOrDefaultAsync(r => r.AccountId == account && r.OperationId == request.OperationId, ct);
            if (existing is not null)
            {
                await AuthorizeReceiptAsync(principal, existing, ct);
                if (existing.FingerprintVersion != CommandFingerprint.Version ||
                    !CryptographicOperations.FixedTimeEquals(existing.RequestFingerprint, fingerprint))
                    throw new ApiException(409, "OperationIdConflict", "This operation ID already identifies a different command.");
                return OriginalResult(existing);
            }

            await authorization.CheckAsync(principal, command.AuthorizationScope, ct);
            var receipt = new OperationReceipt
            {
                AccountId = account, OperationId = request.OperationId,
                EnvironmentGeneration = request.EnvironmentGeneration, CommandType = command.CommandType,
                TargetType = command.TargetType, TargetId = command.TargetId,
                FingerprintVersion = CommandFingerprint.Version, RequestFingerprint = fingerprint
            };
            db.OperationReceipts.Add(receipt);
            await db.SaveChangesAsync(ct);
            await transaction.CreateSavepointAsync("BusinessCommand", ct);
            db.CurrentOperationId = request.OperationId;
            db.OperationResources.Clear();
            IActionResult response;
            JsonNode responseBody;
            string? location = null;
            int status;
            try
            {
                response = await execute();
                if (response is not ObjectResult result || result.Value is null || (result.StatusCode ?? 200) is < 200 or > 299)
                    throw new InvalidOperationException("Business commands must return a successful JSON object or throw ApiException.");
                status = result.StatusCode ?? 200;
                responseBody = JsonSerializer.SerializeToNode(result.Value, result.Value.GetType(), Json)!;
                responseBody["operationId"] = request.OperationId.ToString("D");
                responseBody["outcome"] = "Accepted";
                responseBody["affectedResources"] = JsonSerializer.SerializeToNode(db.OperationResources.Values, Json);
                // CreatedAtAction is resolved by MVC, so explicitly retain its known application location.
                location = result is CreatedResult created ? created.Location :
                    result is CreatedAtActionResult ? $"/api/applications/{command.TargetId}" : null;
            }
            catch (ApiException exception) when (exception.Status is 409 or 422)
            {
                // No business effects may survive a final rejection. A dead/unusable transaction must not commit a receipt.
                try { await transaction.RollbackToSavepointAsync("BusinessCommand", ct); }
                catch (Exception rollbackError) when (rollbackError is SqlException or InvalidOperationException)
                {
                    throw new ApiException(503, "CommandRecoveryRequired", "The command could not be finalized. Retry identically.");
                }
                db.ChangeTracker.Clear();
                db.OperationReceipts.Attach(receipt);
                var problem = ApiProblems.Create(exception.Status, exception.Code, exception.Title, exception.Fields);
                problem.Extensions["operationId"] = request.OperationId;
                problem.Extensions["affectedResources"] = Array.Empty<AffectedResource>();
                responseBody = JsonSerializer.SerializeToNode(problem, Json)!;
                status = exception.Status;
                receipt.Code = exception.Code;
            }

            receipt.Outcome = status is >= 200 and <= 299 ? "Accepted" : "Rejected";
            receipt.HttpStatus = checked((short)status);
            receipt.ResponseSchemaVersion = 1;
            receipt.FinalizedAt = clock.GetUtcNow();
            var scope = receipt.Outcome == "Accepted" ? command.CommandType switch
            {
                "Properties.Create" => new AuthorizationScope("Property", Guid.Parse(command.TargetId), "Owner"),
                "Units.Create" => new AuthorizationScope("Unit", Guid.Parse(command.TargetId), "Owner"),
                "Applications.Create" => new AuthorizationScope("Application", Guid.Parse(command.TargetId), "Applicant"),
                _ => command.AuthorizationScope
            } : command.AuthorizationScope;
            receipt.ResponseJson = JsonSerializer.Serialize(new StoredResponse(
                scope, JsonSerializer.SerializeToElement(responseBody, Json), location), Json);
            await db.SaveChangesAsync(ct);
            RequireFinal(receipt);
            await transaction.CommitAsync(ct);
            logger.LogInformation("Operation {OperationId} {CommandType} completed in {DurationMs} ms with {HttpStatus} and {ErrorCode}",
                request.OperationId, command.CommandType, Stopwatch.GetElapsedTime(started).TotalMilliseconds, status, receipt.Code);
            return OriginalResult(receipt);
        }
        catch (Exception exception) when (exception is SqlException { Number: -2 or 1205 or 1222 or 51000 } ||
            exception.InnerException is SqlException { Number: -2 or 1205 or 1222 or 51000 })
        {
            throw new ApiException(503, "CommandUnavailable", "The command could not complete. Retry identically.");
        }
        finally
        {
            db.CurrentOperationId = null;
            db.OperationResources.Clear();
        }
    }

    public async Task<OperationRecoveryResponse> RecoverAsync(ClaimsPrincipal principal, Guid operationId,
        Guid environmentGeneration, CancellationToken ct)
    {
        RequireUuid7(operationId, "operationId");
        await CheckGenerationAsync(environmentGeneration, ct);
        var account = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var receipt = await db.OperationReceipts.AsNoTracking()
            .SingleOrDefaultAsync(r => r.AccountId == account && r.OperationId == operationId, ct);
        if (receipt is null) return new(operationId, "Unknown");
        await AuthorizeReceiptAsync(principal, receipt, ct);
        var stored = ReadStored(receipt);
        return new(operationId, receipt.Outcome!, receipt.HttpStatus, stored.Body, receipt.ResponseSchemaVersion);
    }

    public async Task CheckGenerationAsync(Guid generation, CancellationToken ct)
    {
        if (generation == Guid.Empty)
            throw new ApiException(400, "MalformedRequest", "Supply environmentGeneration.");
        var current = await db.DatabaseMetadata.AsNoTracking().Where(m => m.SingletonId == 1)
            .Select(m => (Guid?)m.EnvironmentGeneration).SingleOrDefaultAsync(ct);
        if (current is null) throw new ApiException(503, "DatabaseNotInitialized", "Database initialization is required.");
        if (current != generation)
            throw new ApiException(409, "EnvironmentGenerationMismatch", "Server data history has changed. Preserve local work and recover explicitly.");
    }

    private async Task AuthorizeReceiptAsync(ClaimsPrincipal principal, OperationReceipt receipt, CancellationToken ct)
    {
        RequireFinal(receipt);
        await CheckGenerationAsync(receipt.EnvironmentGeneration, ct);
        await authorization.CheckAsync(principal, ReadStored(receipt).AuthorizationScope, ct);
    }

    private IActionResult OriginalResult(OperationReceipt receipt)
    {
        var stored = ReadStored(receipt);
        if (stored.Location is not null && receipt.Outcome == "Accepted")
            return new CreatedResult(stored.Location, stored.Body) { StatusCode = receipt.HttpStatus };
        return new ContentResult
        {
            StatusCode = receipt.HttpStatus,
            ContentType = receipt.Outcome == "Rejected" ? "application/problem+json" : "application/json",
            Content = stored.Body.GetRawText()
        };
    }

    private StoredResponse ReadStored(OperationReceipt receipt) =>
        JsonSerializer.Deserialize<StoredResponse>(receipt.ResponseJson!, Json)
        ?? throw new InvalidOperationException("Unreadable operation receipt.");

    internal static void RequireFinal(OperationReceipt receipt)
    {
        if (receipt.Outcome is not ("Accepted" or "Rejected") || receipt.HttpStatus is null ||
            receipt.ResponseSchemaVersion is null || receipt.ResponseJson is null || receipt.FinalizedAt is null)
            throw new InvalidOperationException("An unfinished operation reservation must never commit.");
    }

    public static void RequireUuid7(Guid id, string field)
    {
        if (id == Guid.Empty || id.Version != 7 || (id.ToByteArray()[8] & 0xc0) != 0x80)
            throw new ApiException(400, "MalformedRequest", $"Supply a UUIDv7 {field}.");
    }

    internal static Task<int> AcquireLockAsync(ApplicationDbContext db, string resource, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive',
                @LockOwner='Transaction', @LockTimeout=10000;
            IF @result < 0 THROW 51000, 'Command lock unavailable.', 1;
            """, ct);

    private sealed record StoredResponse(AuthorizationScope AuthorizationScope, JsonElement Body, string? Location);
}
