using System.Data;
using System.Globalization;
using System.Security.Claims;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Services.Applications;
using RentalManagement.Api.Validation;

namespace RentalManagement.Api.Services;

public sealed class ApplicationService(ApplicationDbContext db, TimeProvider clock)
{
    public async Task<ApplicationPage> ListAsync(ClaimsPrincipal principal, ApplicationListQuery request, CancellationToken ct)
    {
        var (user, manager) = Identity(principal);
        var status = ApplicationValidation.Query(request, manager);

        var query = from a in db.RentalApplications.AsNoTracking()
                    join u in db.Units.AsNoTracking() on a.UnitId equals u.Id
                    join p in db.Properties.AsNoTracking() on u.PropertyId equals p.Id
                    where (manager || a.ApplicantId == user) &&
                        (!manager || request.ShowArchived || (u.ArchivedAt == null && p.ArchivedAt == null)) &&
                        (status == null || a.Status == status) && (request.PropertyId == null || p.Id == request.PropertyId)
                    select new { Application = a, Unit = u, Property = p };

        var ordered = (request.SortBy, request.SortDirection) switch
        {
            ("createdAt", "asc") => query.OrderBy(r => r.Application.CreatedAt),
            ("statusChangedAt", "asc") => query.OrderBy(r => r.Application.StatusChangedAt),
            ("statusChangedAt", _) => query.OrderByDescending(r => r.Application.StatusChangedAt),
            _ => query.OrderByDescending(r => r.Application.CreatedAt)
        };

        return await ReadTransactionAsync(async () =>
        {
            var total = await query.CountAsync(ct);
            var rows = await ordered.ThenBy(r => r.Application.Id.ToString())
                .Skip((request.Page - 1) * 20).Take(20).ToListAsync(ct);
            return new ApplicationPage(rows.Select(r => Row(r.Application, r.Unit, r.Property)).ToArray(), total, request.Page, 20);
        }, IsolationLevel.Serializable, ct);
    }

    public async Task<ApplicationDetailResponse> ReadAsync(ClaimsPrincipal principal, Guid id, CancellationToken ct)
    {
        var (user, manager) = Identity(principal);
        return await ReadTransactionAsync(async () =>
        {
            var application = await AccessibleAsync(id, user, manager, ct);
            return await DetailAsync(application, manager ? user : null, ct);
        }, IsolationLevel.RepeatableRead, ct);
    }

    public async Task<ApplicationDetailResponse> CreateAsync(ClaimsPrincipal principal, CreateApplicationRequest request, CancellationToken ct)
    {
        var user = RequireRole(principal, false);
        if (request.Id == Guid.Empty) ApplicationValidation.Invalid("id", "Supply an application UUID.");
        if (request.UnitId == Guid.Empty) ApplicationValidation.Invalid("unitId", "Supply a unit UUID.");
        var info = ApplicationValidation.Information(request.ApplicantInformation);

        return await WriteAsync(async () =>
        {
            var (unit, property, guard) = await LockInventoryAsync(request.UnitId, ct);
            var now = clock.GetUtcNow();

            if (unit.ArchivedAt is not null || property.ArchivedAt is not null)
                throw new ApiException(409, "InventoryArchived", "New applications require active inventory.");

            Available(guard, now);

            if (await db.RentalApplications.AnyAsync(a => a.Id == request.Id, ct))
                throw new ApiException(409, "ApplicationIdAlreadyUsed", "The application ID is already used.");

            if (await db.RentalApplications.AnyAsync(a => a.ApplicantId == user && a.UnitId == unit.Id &&
                (a.Status == ApplicationStatus.Draft || a.Status == ApplicationStatus.Submitted ||
                 a.Status == ApplicationStatus.InReview || a.Status == ApplicationStatus.Returned), ct))
                throw new ApiException(409, "DuplicateOpenApplication", "You already have an open application for this unit.");

            var application = new RentalApplication
            {
                Id = request.Id,
                ApplicantId = user,
                UnitId = unit.Id,
                Status = ApplicationStatus.Draft,
                ApplicantInformationSavedAt = now,
                StatusChangedAt = now
            };

            SetInformation(application, info);
            db.RentalApplications.Add(application);
            await HistoryAsync(application, user, ApplicationAction.Create, null, null, now, ct);
            await db.SaveChangesAsync(ct);
            return await DetailAsync(application, null, ct);
        }, ct);
    }

    public async Task<ApplicationDetailResponse> SaveInformationAsync(ClaimsPrincipal principal, Guid id,
        ApplicantInformationRequest request, CancellationToken ct)
    {
        var user = RequireRole(principal, false);
        ApplicationValidation.Version(request.ExpectedVersion);
        var info = ApplicationValidation.Information(request.ApplicantInformation);

        return await SaveSectionAsync(user, id, request.ExpectedVersion, application =>
        {
            SetInformation(application, info);
            application.ApplicantInformationSavedAt = clock.GetUtcNow();
        }, null, ct);
    }

    public async Task<ApplicationDetailResponse> SaveResidencesAsync(ClaimsPrincipal principal, Guid id,
        ResidenceHistoryRequest request, CancellationToken ct)
    {
        var user = RequireRole(principal, false);
        ApplicationValidation.Version(request.ExpectedVersion);
        var rows = ApplicationValidation.Residences(request, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));

        return await SaveSectionAsync(user, id, request.ExpectedVersion,
            a => a.ResidenceHistorySavedAt = clock.GetUtcNow(), rows, ct);
    }

    private Task<ApplicationDetailResponse> SaveSectionAsync(Guid user, Guid id, long version,
        Action<RentalApplication> change, IReadOnlyList<ResidenceInput?>? residences, CancellationToken ct) => WriteAsync(async () =>
    {
        var application = await AccessibleAsync(id, user, false, ct);
        CheckVersion(application.Version, version);

        if (application.Status is not (ApplicationStatus.Draft or ApplicationStatus.Returned))
            throw new ApiException(409, "ApplicationNotEditable", "Only Draft and Returned sections can be edited.");

        change(application);
        db.Entry(application).Property(a => a.UpdatedAt).IsModified = true;
        await db.SaveChangesAsync(ct);

        if (residences is not null)
        {
            await db.ApplicationResidences.Where(r => r.ApplicationId == id).ExecuteDeleteAsync(ct);
            db.ApplicationResidences.AddRange(residences.Select((input, position) =>
            {
                var r = input!;
                ProfileValidation.TryDate(r.MoveInDate, out var moveIn);
                ProfileValidation.TryDate(r.MoveOutDate, out var moveOut);
                return new ApplicationResidence
                {
                    ApplicationId = id,
                    Position = position,
                    Address = Address(r.Address!),
                    LandlordName = r.LandlordName!,
                    LandlordPhone = r.LandlordPhone!,
                    MoveInDate = moveIn,
                    MoveOutDate = moveOut
                };
            }));
            await db.SaveChangesAsync(ct);
        }

        return await DetailAsync(application, null, ct);
    }, ct);

    public async Task<ApplicationDetailResponse> ActAsync(ClaimsPrincipal principal, Guid id,
        ApplicationAction action, ApplicationActionRequest request, CancellationToken ct)
    {
        var manager = action is not (ApplicationAction.Submit or ApplicationAction.Withdraw);
        var user = RequireRole(principal, manager);
        ApplicationValidation.Version(request.ExpectedVersion);

        var comment = ApplicationValidation.Comment(request.Comment, action is ApplicationAction.Return or ApplicationAction.Deny);
        if (action is not (ApplicationAction.Return or ApplicationAction.Deny or ApplicationAction.Approve) && comment is not null)
            ApplicationValidation.Invalid("comment", "This action does not accept a comment.");

        return await WriteAsync(async () =>
        {
            var unitId = await db.RentalApplications
                .Where(a => a.Id == id && (manager || a.ApplicantId == user))
                .Select(a => (Guid?)a.UnitId).SingleOrDefaultAsync(ct)
                ?? throw NotFound();
            var (_, property, guard) = await LockInventoryAsync(unitId, ct);

            if (manager && property.OwnerManagerId != user)
                throw Forbidden();

            var application = await AccessibleAsync(id, user, manager, ct);
            CheckVersion(application.Version, request.ExpectedVersion);

            var next = ApplicationRules.Transition(application.Status, action);
            var now = clock.GetUtcNow();

            if (action is ApplicationAction.Submit or ApplicationAction.Approve) Available(guard, now);
            if (action == ApplicationAction.Submit && application.ResidenceHistorySavedAt is null)
                throw new ApiException(409, "ApplicationSectionsIncomplete", "Save both sections before submission.");

            var previous = application.Status;
            application.Status = next;
            application.StatusChangedAt = now;
            if (action == ApplicationAction.Approve)
            {
                var start = DateOnly.FromDateTime(now.UtcDateTime);
                var end = start.AddMonths(12);
                db.Leases.Add(new Lease { ApplicationId = id, StartDate = start, EndDateExclusive = end, ApprovedAt = now });
                CheckVersion(guard.Version, guard.Version);
                guard.ConfirmedLeaseEndExclusive = end;
            }

            await HistoryAsync(application, user, action, previous, comment, now, ct);
            await db.SaveChangesAsync(ct);
            return await DetailAsync(application, manager ? user : null, ct);
        }, ct);
    }

    public async Task<ManagerNoteResponse> SaveNoteAsync(ClaimsPrincipal principal, Guid id,
        SaveManagerNoteRequest request, CancellationToken ct)
    {
        var user = RequireRole(principal, true);
        if (request.Body is null) ApplicationValidation.Invalid("body", "Supply the note body; empty is allowed.");
        if (request.Body!.Length > 2000) ApplicationValidation.Invalid("body", "Use at most 2000 characters.");
        if (request.ExpectedVersion is { } version) ApplicationValidation.Version(version);

        return await WriteAsync(async () =>
        {
            if (!await db.RentalApplications.AnyAsync(a => a.Id == id, ct))
                throw NotFound();
            var note = await db.ManagerNotes.SingleOrDefaultAsync(n => n.ApplicationId == id && n.AuthorManagerId == user, ct);
            if (note is null)
            {
                if (request.ExpectedVersion is not null) throw Stale();
                note = new ManagerNote { ApplicationId = id, AuthorManagerId = user, Body = request.Body };
                db.ManagerNotes.Add(note);
            }
            else
            {
                if (request.ExpectedVersion is null) throw Stale();
                CheckVersion(note.Version, request.ExpectedVersion.Value);
                note.Body = request.Body;
                db.Entry(note).Property(n => n.UpdatedAt).IsModified = true;
            }
            await db.SaveChangesAsync(ct);
            return Note(note);
        }, ct, noteWrite: true);
    }

    public async Task<RejectAllApplicationsResponse> RejectAllAsync(ClaimsPrincipal principal, Guid unitId,
        RejectAllApplicationsRequest request, CancellationToken ct)
    {
        var user = RequireRole(principal, true);
        var comment = ApplicationValidation.Comment(request.Comment, true);

        return await WriteAsync(async () =>
        {
            var (_, property, _) = await LockInventoryAsync(unitId, ct);
            if (property.OwnerManagerId != user) throw Forbidden();
            var applications = await db.RentalApplications.FromSqlInterpolated($"""
                SELECT * FROM [RentalApplications] WITH (UPDLOCK, HOLDLOCK)
                WHERE [UnitId] = {unitId} AND [Status] IN ('Draft', 'Submitted', 'InReview', 'Returned')
                """).OrderBy(a => a.Id).ToListAsync(ct);
            var now = clock.GetUtcNow();
            foreach (var application in applications)
            {
                CheckVersion(application.Version, application.Version);
                var previous = application.Status;
                application.Status = ApplicationStatus.Denied;
                application.StatusChangedAt = now;
                await HistoryAsync(application, user, ApplicationAction.Deny, previous, comment, now, ct);
            }
            await db.SaveChangesAsync(ct);
            return new RejectAllApplicationsResponse(applications.Count);
        }, ct);
    }

    private async Task<(Unit, Property, UnitLeaseGuard)> LockInventoryAsync(Guid unitId, CancellationToken ct)
    {
        var propertyId = await db.Units
            .Where(u => u.Id == unitId)
            .Select(u => (Guid?)u.PropertyId)
            .SingleOrDefaultAsync(ct)
            ?? throw NotFound();
        var property = await db.Properties.FromSqlInterpolated(
            $"SELECT * FROM [Properties] WITH (HOLDLOCK) WHERE [Id] = {propertyId}").SingleAsync(ct);
        var unit = await db.Units.FromSqlInterpolated(
            $"SELECT * FROM [Units] WITH (HOLDLOCK) WHERE [Id] = {unitId}").SingleAsync(ct);
        var guard = await db.UnitLeaseGuards.FromSqlInterpolated(
            $"SELECT * FROM [UnitLeaseGuards] WITH (UPDLOCK, HOLDLOCK) WHERE [UnitId] = {unitId}").SingleAsync(ct);
        return (unit, property, guard);
    }

    private async Task<RentalApplication> AccessibleAsync(Guid id, Guid user, bool manager, CancellationToken ct) =>
        await db.RentalApplications
            .SingleOrDefaultAsync(a => a.Id == id && (manager || a.ApplicantId == user), ct)
            ?? throw NotFound();

    private async Task HistoryAsync(RentalApplication application, Guid actor, ApplicationAction action,
        ApplicationStatus? previous, string? comment, DateTimeOffset now, CancellationToken ct)
    {
        var sequence = (await db.ApplicationStatusHistory
            .Where(h => h.ApplicationId == application.Id)
            .MaxAsync(h => (long?)h.Sequence, ct)
            ?? 0) + 1;
        db.ApplicationStatusHistory.Add(new ApplicationStatusHistory
        {
            ApplicationId = application.Id,
            ActorUserId = actor,
            Sequence = sequence,
            Action = action,
            FromStatus = previous,
            ToStatus = application.Status,
            Comment = comment,
            OccurredAt = now
        });
    }

    private async Task<ApplicationDetailResponse> DetailAsync(RentalApplication a, Guid? manager, CancellationToken ct)
    {
        var unit = await db.Units
            .AsNoTracking()
            .SingleAsync(u => u.Id == a.UnitId, ct);
        var property = await db.Properties
            .AsNoTracking()
            .SingleAsync(p => p.Id == unit.PropertyId, ct);
        var residences = await db
            .ApplicationResidences
            .AsNoTracking()
            .Where(r => r.ApplicationId == a.Id)
            .OrderBy(r => r.MoveInDate).ThenBy(r => r.MoveOutDate).ThenBy(r => r.Position)
            .ToListAsync(ct);
        var history = await db.ApplicationStatusHistory
            .AsNoTracking()
            .Where(h => h.ApplicationId == a.Id)
            .OrderBy(h => h.Sequence)
            .ToListAsync(ct);
        var lease = await db.Leases
            .AsNoTracking()
            .SingleOrDefaultAsync(l => l.ApplicationId == a.Id, ct);
        var note = manager is null ? null : await db.ManagerNotes.AsNoTracking()
            .SingleOrDefaultAsync(n => n.ApplicationId == a.Id && n.AuthorManagerId == manager, ct);
        return new(
            Row(a, unit, property),
            new(a.ApplicantName, a.ApplicantPhone, a.ContactEmail, AddressDto(a.CurrentAddress)),
            residences.Select(r => new ResidenceResponse(
                r.Position, AddressDto(r.Address), r.LandlordName, r.LandlordPhone,
                WireDate(r.MoveInDate), WireDate(r.MoveOutDate)
            )).ToArray(),
            a.ApplicantInformationSavedAt, a.ResidenceHistorySavedAt,
            history.Select(h => new ApplicationHistoryResponse(
                h.Id, h.Sequence, h.ActorUserId, h.Action.ToString(),
                h.FromStatus?.ToString(), h.ToStatus.ToString(), h.Comment, h.OccurredAt
            )).ToArray(),
            lease is null ? null : new(
                lease.Id, WireDate(lease.StartDate), WireDate(lease.EndDateExclusive), lease.ApprovedAt
            ),
            note is null ? null : Note(note));
    }

    private async Task<T> ReadTransactionAsync<T>(Func<Task<T>> read, IsolationLevel isolation, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await using var transaction = await db.Database.BeginTransactionAsync(isolation, ct);
                var result = await read();
                await transaction.CommitAsync(ct);
                return result;
            }
            catch (Exception e) when (e is SqlException { Number: 1205 or 1222 } ||
                e.InnerException is SqlException { Number: 1205 or 1222 })
            {
                db.ChangeTracker.Clear();
                if (attempt >= 2)
                    throw new ApiException(503, "ApplicationReadUnavailable", "A consistent read could not complete. Retry the request.");
            }
        }
    }

    private async Task<T> WriteAsync<T>(Func<Task<T>> write, CancellationToken ct, bool noteWrite = false)
    {
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var response = await write();
            await transaction.CommitAsync(ct);
            return response;
        }
        catch (DbUpdateConcurrencyException) { throw Stale(); }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 2601 or 2627 })
        {
            if (noteWrite) throw Stale();
            throw new ApiException(409, "ApplicationConflict", "An application or lease conflicts with this request.");
        }
        catch (Exception e) when (e is SqlException { Number: 1205 or 1222 } || e.InnerException is SqlException { Number: 1205 or 1222 })
        {
            throw new ApiException(503, "ApplicationWriteUnavailable", "The application write could not complete. Retry the request.");
        }
    }

    private static (Guid User, bool Manager) Identity(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true ||
            !Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var user))
            throw new ApiException(401, "Unauthenticated", "Authentication required.");
        var manager = principal.IsInRole(AccountRoles.PropertyManager);
        if (!manager && !principal.IsInRole(AccountRoles.Applicant)) throw Forbidden();
        return (user, manager);
    }
    private static Guid RequireRole(ClaimsPrincipal principal, bool manager)
    {
        var identity = Identity(principal);
        if (identity.Manager != manager) throw Forbidden();
        return identity.User;
    }
    private static void CheckVersion(long actual, long expected)
    {
        if (actual != expected) throw Stale();
        if (actual == long.MaxValue) throw new ApiException(409, "ApplicationVersionExhausted", "The resource cannot be updated.");
    }
    private static void Available(UnitLeaseGuard guard, DateTimeOffset now)
    {
        if (guard.ConfirmedLeaseEndExclusive is { } end && end > DateOnly.FromDateTime(now.UtcDateTime))
            throw new ApiException(409, "UnitUnavailable", "The unit has an active lease.");
    }
    private static void SetInformation(RentalApplication a, ApplicantInformation info)
    {
        a.ApplicantName = info.Name!;
        a.ApplicantPhone = info.Phone!;
        a.ContactEmail = info.ContactEmail!;
        a.CurrentAddress = Address(info.CurrentAddress!);
    }
    private static ApplicationRow Row(RentalApplication a, Unit u, Property p) => new(a.Id, a.ApplicantId, u.Id, p.Id,
        u.Number, AddressDto(p.Address), u.ArchivedAt is not null || p.ArchivedAt is not null,
        a.ApplicantName, a.Status.ToString(), a.CreatedAt, a.StatusChangedAt, a.Version);
    private static ManagerNoteResponse Note(ManagerNote note) => new(note.Body, note.CreatedAt, note.UpdatedAt, note.Version);
    private static Address Address(ProfileAddress a) => new() { DisplayName = a.DisplayName, StreetAddress = a.StreetAddress, Line2 = a.Line2 };
    private static ProfileAddress AddressDto(Address a) => new(a.DisplayName, a.StreetAddress, a.Line2);
    private static string WireDate(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00Z";
    private static ApiException Stale() => new(409, "StaleVersion", "The resource has changed. Reload it before saving.");
    private static ApiException NotFound() => new(404, "ApplicationNotFound", "Application or unit not found.");
    private static ApiException Forbidden() => new(403, "Forbidden", "This action requires the appropriate role and property ownership.");
}
