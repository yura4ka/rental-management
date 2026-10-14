using System.Security.Cryptography;
using System.Text;
using Bogus;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Domain;

namespace RentalManagement.Api.Persistence.Seeding;

internal sealed record DemoAccount(Guid Id, string Email, string Role);

internal sealed class DemoSeedData
{
    internal const int CurrentVersion = 1;
    internal static readonly string[] TypeCodes = ["Apartment", "Studio", "Loft", "Penthouse"];
    internal List<DemoAccount> Accounts { get; } = [];
    internal List<Property> Properties { get; } = [];
    internal List<Unit> Units { get; } = [];
    internal List<UnitLeaseGuard> Guards { get; } = [];
    internal List<ApplicantProfile> Profiles { get; } = [];
    internal List<ProfileResidence> ProfileResidences { get; } = [];
    internal List<RentalApplication> Applications { get; } = [];
    internal List<ApplicationResidence> ApplicationResidences { get; } = [];
    internal List<ApplicationStatusHistory> History { get; } = [];
    internal List<Lease> Leases { get; } = [];

    internal static Guid Id(string key, int version = CurrentVersion)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"RentalManagement.Demo:v{version}:{key}"));
        return new Guid(hash.AsSpan(0, 16));
    }

    internal static DemoSeedData Create(IReadOnlyDictionary<string, Guid> typeIds, int version = CurrentVersion)
    {
        if (version < 1) throw new ArgumentOutOfRangeException(nameof(version));
        var result = new DemoSeedData();
        var faker = new Faker("en") { Random = new Randomizer(version) };
        var epoch = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        Guid Key(string key) => Id(key, version);
        Address NewAddress() => new() { StreetAddress = faker.Address.StreetAddress(), DisplayName = "Demo residence" };
        static Address Copy(Address address) => new() { StreetAddress = address.StreetAddress, DisplayName = address.DisplayName, Line2 = address.Line2 };
        string Phone() => faker.Random.Replace("###-###-####");

        for (var i = 0; i < 2; i++)
            result.Accounts.Add(new(Key($"manager:{i}"), $"demo.v{version}.manager{i + 1}@example.com", AccountRoles.PropertyManager));
        for (var i = 0; i < 4; i++)
            result.Properties.Add(new Property
            {
                Id = Key($"property:{i}"), OwnerManagerId = result.Accounts[i % 2].Id,
                Address = NewAddress(), CreatedAt = epoch, UpdatedAt = epoch
            });
        for (var i = 0; i < 8; i++)
        {
            var type = i == 7 ? "Penthouse" : TypeCodes[i % 3];
            result.Units.Add(new Unit
            {
                Id = Key($"unit:{i}"), PropertyId = result.Properties[i / 2].Id, UnitTypeId = typeIds[type],
                Number = $"{i + 101}", Bedrooms = type == "Studio" ? 0 : faker.Random.Int(1, 3),
                MonthlyRent = faker.Random.Int(1000, 4000), CreatedAt = epoch, UpdatedAt = epoch
            });
            result.Guards.Add(new UnitLeaseGuard { UnitId = result.Units[i].Id });
        }

        var statuses = Enum.GetValues<ApplicationStatus>();
        for (var i = 0; i < statuses.Length; i++)
        {
            var applicantId = Key($"applicant:{i}");
            var email = $"demo.v{version}.applicant{i + 1}@example.com";
            result.Accounts.Add(new(applicantId, email, AccountRoles.Applicant));
            var profile = new ApplicantProfile
            {
                ApplicantId = applicantId, Name = faker.Name.FullName(), Phone = Phone(), ContactEmail = email,
                CurrentAddress = NewAddress(), CreatedAt = epoch, UpdatedAt = epoch
            };
            result.Profiles.Add(profile);
            var residence = new ProfileResidence
            {
                ApplicantId = applicantId, Position = 0, Address = NewAddress(), LandlordName = faker.Name.FullName(),
                LandlordPhone = Phone(), MoveInDate = new DateOnly(2023, 1, 1), MoveOutDate = new DateOnly(2025, 12, 31)
            };
            result.ProfileResidences.Add(residence);
            var application = new RentalApplication
            {
                Id = Key($"application:{i}"), ApplicantId = applicantId, UnitId = result.Units[i].Id,
                ApplicantName = profile.Name!, ApplicantPhone = profile.Phone!, ContactEmail = email,
                CurrentAddress = Copy(profile.CurrentAddress), ApplicantInformationSavedAt = epoch,
                ResidenceHistorySavedAt = epoch, CreatedAt = epoch, UpdatedAt = epoch, StatusChangedAt = epoch,
                Status = ApplicationStatus.Draft
            };
            result.Applications.Add(application);
            result.ApplicationResidences.Add(new ApplicationResidence
            {
                ApplicationId = application.Id, Position = 0, Address = Copy(residence.Address),
                LandlordName = residence.LandlordName, LandlordPhone = residence.LandlordPhone,
                MoveInDate = residence.MoveInDate, MoveOutDate = residence.MoveOutDate
            });
            var manager = result.Properties[i / 2].OwnerManagerId;
            void Transition(ApplicationAction action, ApplicationStatus to, Guid actor, string? comment = null)
            {
                var sequence = result.History.Count(h => h.ApplicationId == application.Id) + 1;
                var at = epoch.AddMinutes(sequence - 1);
                result.History.Add(new ApplicationStatusHistory
                {
                    Id = Key($"history:{i}:{sequence}"), ApplicationId = application.Id, Sequence = sequence,
                    ActorUserId = actor, OperationId = Key($"operation:{i}:{sequence}"), Action = action,
                    FromStatus = action == ApplicationAction.Create ? null : application.Status,
                    ToStatus = to, Comment = comment, OccurredAt = at
                });
                application.Status = to;
                application.StatusChangedAt = application.UpdatedAt = at;
                application.Version = sequence;
            }
            Transition(ApplicationAction.Create, ApplicationStatus.Draft, applicantId);
            if (statuses[i] != ApplicationStatus.Draft)
                Transition(ApplicationAction.Submit, ApplicationStatus.Submitted, applicantId);
            if (statuses[i] is ApplicationStatus.InReview or ApplicationStatus.Returned or ApplicationStatus.Approved or ApplicationStatus.Denied)
                Transition(ApplicationAction.StartReview, ApplicationStatus.InReview, manager);
            switch (statuses[i])
            {
                case ApplicationStatus.Returned:
                    Transition(ApplicationAction.Return, ApplicationStatus.Returned, manager, "Please confirm your residence history.");
                    break;
                case ApplicationStatus.Denied:
                    Transition(ApplicationAction.Deny, ApplicationStatus.Denied, manager, "Demonstration denial decision.");
                    break;
                case ApplicationStatus.Withdrawn:
                    Transition(ApplicationAction.Withdraw, ApplicationStatus.Withdrawn, applicantId);
                    break;
                case ApplicationStatus.Approved:
                    Transition(ApplicationAction.Approve, ApplicationStatus.Approved, manager);
                    var start = DateOnly.FromDateTime(application.StatusChangedAt.UtcDateTime);
                    result.Leases.Add(new Lease
                    {
                        Id = Key($"lease:{i}"), ApplicationId = application.Id, StartDate = start,
                        EndDateExclusive = start.AddMonths(12), ApprovedAt = application.StatusChangedAt
                    });
                    result.Guards[i].ConfirmedLeaseEndExclusive = start.AddMonths(12);
                    break;
            }
        }
        return result;
    }
}
