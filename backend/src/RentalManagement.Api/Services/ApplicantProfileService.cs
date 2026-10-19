using System.Data;
using System.Globalization;
using System.Security.Claims;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Services.Profiles;
using RentalManagement.Api.Validation;

namespace RentalManagement.Api.Services;

public sealed class ApplicantProfileService(ApplicationDbContext db,
    IValidator<ApplicantInformationRequest> contactRequests, IValidator<ApplicantInformationCommand> contactCommands,
    IValidator<ResidenceHistoryRequest> residenceRequests, IValidator<ResidenceHistoryCommand> residenceCommands)
{
    public async Task<ApplicantProfileResponse> ReadAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var id = ApplicantId(principal);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken);
        var rows = await (
            from profile in db.ApplicantProfiles.AsNoTracking()
            where profile.ApplicantId == id
            join residence in db.ProfileResidences.AsNoTracking()
                on profile.ApplicantId equals residence.ApplicantId into residences
            from residence in residences.DefaultIfEmpty()
            orderby residence.MoveInDate, residence.MoveOutDate, residence.Position
            select new { Profile = profile, Residence = residence }
        ).ToListAsync(cancellationToken);
        if (rows.Count == 0)
            throw new ApiException(404, "ProfileNotFound", "Profile not found.");
        var response = Response(rows[0].Profile, rows.Where(r => r.Residence is not null).Select(r => r.Residence!));
        await transaction.CommitAsync(cancellationToken);
        return response;
    }

    public async Task<ApplicantProfileResponse> ReplaceInformationAsync(ClaimsPrincipal principal,
        ApplicantInformationRequest request, CancellationToken cancellationToken)
    {
        var id = ApplicantId(principal);
        var command = ApplicantInformationCommand.FromRequest(request);
        ValidationErrors.ThrowIfInvalid(await contactRequests.ValidateAsync(request, cancellationToken),
            await contactCommands.ValidateAsync(command, cancellationToken));
        return await ReplaceAsync(id, command.ExpectedVersion, profile =>
        {
            var info = command.ApplicantInformation!;
            profile.Name = info.Name;
            profile.Phone = info.Phone;
            profile.ContactEmail = info.ContactEmail;
            profile.CurrentAddress = Address(info.CurrentAddress!);
        }, null, cancellationToken);
    }

    public async Task<ApplicantProfileResponse> ReplaceResidencesAsync(ClaimsPrincipal principal,
        ResidenceHistoryRequest request, CancellationToken cancellationToken)
    {
        var id = ApplicantId(principal);
        var command = ResidenceHistoryCommand.FromRequest(request);
        ValidationErrors.ThrowIfInvalid(await residenceRequests.ValidateAsync(request, cancellationToken),
            await residenceCommands.ValidateAsync(command, cancellationToken));
        return await ReplaceAsync(id, command.ExpectedVersion, _ => { }, command.ResidenceHistory!, cancellationToken);
    }

    private async Task<ApplicantProfileResponse> ReplaceAsync(Guid id, long expectedVersion,
        Action<ApplicantProfile> change, IReadOnlyList<ResidenceInput?>? residences, CancellationToken cancellationToken)
    {
        await using var transaction = db.Database.CurrentTransaction is null
            ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var profile = await db.ApplicantProfiles.SingleOrDefaultAsync(p => p.ApplicantId == id, cancellationToken)
            ?? throw new ApiException(404, "ProfileNotFound", "Profile not found.");
        if (profile.Version != expectedVersion) throw StaleVersion();
        if (profile.Version == long.MaxValue)
            throw new ApiException(409, "ProfileVersionExhausted", "The profile cannot be updated.");
        change(profile);
        db.Entry(profile).Property(p => p.UpdatedAt).IsModified = true;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            if (residences is not null)
            {
                await db.ProfileResidences.Where(r => r.ApplicantId == id).ExecuteDeleteAsync(cancellationToken);
                db.ProfileResidences.AddRange(residences.Select((input, position) =>
                {
                    var row = input!;
                    ProfileValidation.TryDate(row.MoveInDate, out var moveIn);
                    ProfileValidation.TryDate(row.MoveOutDate, out var moveOut);
                    return new ProfileResidence
                    {
                        ApplicantId = id,
                        Position = position,
                        Address = Address(row.Address!),
                        LandlordName = row.LandlordName!,
                        LandlordPhone = row.LandlordPhone!,
                        MoveInDate = moveIn,
                        MoveOutDate = moveOut
                    };
                }));
                await db.SaveChangesAsync(cancellationToken);
            }
            var rows = await db.ProfileResidences.AsNoTracking()
                .Where(r => r.ApplicantId == profile.ApplicantId)
                .OrderBy(r => r.MoveInDate).ThenBy(r => r.MoveOutDate).ThenBy(r => r.Position)
                .ToListAsync(cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return Response(profile, rows);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw StaleVersion();
        }
    }

    private static ApplicantProfileResponse Response(ApplicantProfile profile, IEnumerable<ProfileResidence> rows) =>
        new(new(profile.Name, profile.Phone, profile.ContactEmail, AddressDto(profile.CurrentAddress)),
            rows.Select(r => new ResidenceResponse(r.Position, AddressDto(r.Address), r.LandlordName,
                r.LandlordPhone, WireDate(r.MoveInDate), WireDate(r.MoveOutDate))).ToArray(), profile.Version);

    private static Guid ApplicantId(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true ||
            !Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            throw new ApiException(401, "Unauthenticated", "Authentication required.");
        if (!principal.IsInRole(AccountRoles.Applicant))
            throw new ApiException(403, "Forbidden", "Applicant access required.");
        return id;
    }

    private static ApiException StaleVersion() => new(409, "StaleVersion", "The profile has changed. Reload it before saving.");
    private static Address Address(ProfileAddress address) => new()
    { DisplayName = address.DisplayName, StreetAddress = address.StreetAddress, Line2 = address.Line2 };
    private static ProfileAddress AddressDto(Address address) => new(address.DisplayName, address.StreetAddress, address.Line2);
    private static string WireDate(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00Z";
}
