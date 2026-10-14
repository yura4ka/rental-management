using System.Text.Json;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Persistence.Seeding;

namespace RentalManagement.UnitTests;

public sealed class DemoSeedDataTests
{
    private static DemoSeedData Create(int version = DemoSeedData.CurrentVersion) => DemoSeedData.Create(
        DemoSeedData.TypeCodes.ToDictionary(c => c, c => DemoSeedData.Id($"type:{c}", 0)), version);

    private static string Snapshot(DemoSeedData data) => JsonSerializer.Serialize(new
    {
        data.Accounts, data.Properties, data.Units, data.Guards, data.Profiles, data.ProfileResidences,
        data.Applications, data.ApplicationResidences, data.History, data.Leases
    });

    [Fact]
    public void GenerationIsDeterministicAndIndependentOfGlobalBogusRandomState()
    {
        var first = Snapshot(Create());
        Bogus.Randomizer.Seed = new Random(9876);
        Assert.Equal(first, Snapshot(Create()));
    }

    [Fact]
    public void VersionsHaveDisjointGraphIdsAndAccountEmails()
    {
        var first = Create(1);
        var second = Create(2);
        Assert.Empty(first.Accounts.Select(a => a.Id).Intersect(second.Accounts.Select(a => a.Id)));
        Assert.Empty(first.Accounts.Select(a => a.Email).Intersect(second.Accounts.Select(a => a.Email)));
        Assert.Empty(first.Properties.Select(p => p.Id).Intersect(second.Properties.Select(p => p.Id)));
        Assert.Empty(first.Applications.Select(a => a.Id).Intersect(second.Applications.Select(a => a.Id)));
        Assert.Empty(first.History.Select(h => h.OperationId).Intersect(second.History.Select(h => h.OperationId)));
    }

    [Fact]
    public void IncludesRequiredAccountsInventoryAndEveryStatus()
    {
        var data = Create();
        Assert.Equal(2, data.Accounts.Count(a => a.Role == AccountRoles.PropertyManager));
        Assert.Equal(7, data.Accounts.Count(a => a.Role == AccountRoles.Applicant));
        Assert.Equal(4, data.Properties.Count);
        Assert.Equal(8, data.Units.Count);
        Assert.Equal(Enum.GetValues<ApplicationStatus>(), data.Applications.Select(a => a.Status));
        Assert.Contains(data.Units, u => u.UnitTypeId == DemoSeedData.Id("type:Penthouse", 0));
        Assert.Equal(data.Units.Count, data.Guards.Count);
    }

    [Fact]
    public void HistoryReachesCurrentStatusWithLegalActorsAndChronology()
    {
        var data = Create();
        foreach (var application in data.Applications)
        {
            var history = data.History.Where(h => h.ApplicationId == application.Id).OrderBy(h => h.Sequence).ToArray();
            Assert.Equal(ApplicationAction.Create, history[0].Action);
            Assert.Null(history[0].FromStatus);
            Assert.Equal(application.Status, history[^1].ToStatus);
            Assert.Equal(application.StatusChangedAt, history[^1].OccurredAt);
            Assert.Equal(history.Length, application.Version);
            for (var i = 0; i < history.Length; i++)
            {
                Assert.Equal(i + 1, history[i].Sequence);
                if (i > 0)
                {
                    Assert.Equal(history[i - 1].ToStatus, history[i].FromStatus);
                    Assert.True(history[i - 1].OccurredAt < history[i].OccurredAt);
                }
                var managerAction = history[i].Action is ApplicationAction.StartReview or ApplicationAction.Return or ApplicationAction.Deny or ApplicationAction.Approve;
                var owner = data.Properties.Single(p => p.Id == data.Units.Single(u => u.Id == application.UnitId).PropertyId).OwnerManagerId;
                Assert.Equal(managerAction ? owner : application.ApplicantId, history[i].ActorUserId);
                if (history[i].Action is ApplicationAction.Return or ApplicationAction.Deny)
                    Assert.False(string.IsNullOrWhiteSpace(history[i].Comment));
            }
        }
    }

    [Fact]
    public void ApprovedLeaseAndGuardAreConsistent()
    {
        var data = Create();
        var approved = Assert.Single(data.Applications, a => a.Status == ApplicationStatus.Approved);
        var lease = Assert.Single(data.Leases);
        Assert.Equal(approved.Id, lease.ApplicationId);
        Assert.Equal(approved.StatusChangedAt, lease.ApprovedAt);
        Assert.Equal(DateOnly.FromDateTime(lease.ApprovedAt.UtcDateTime), lease.StartDate);
        Assert.Equal(lease.StartDate.AddMonths(12), lease.EndDateExclusive);
        Assert.Equal(lease.EndDateExclusive, data.Guards.Single(g => g.UnitId == approved.UnitId).ConfirmedLeaseEndExclusive);
        Assert.All(data.Guards.Where(g => g.UnitId != approved.UnitId), g => Assert.Null(g.ConfirmedLeaseEndExclusive));
    }

    [Fact]
    public void ApplicationSnapshotsAreIndependentOfProfiles()
    {
        var data = Create();
        var profile = data.Profiles[0];
        var application = data.Applications.Single(a => a.ApplicantId == profile.ApplicantId);
        var street = application.CurrentAddress.StreetAddress;
        profile.CurrentAddress.StreetAddress = "Edited profile";
        Assert.Equal(street, application.CurrentAddress.StreetAddress);
        Assert.All(data.ApplicationResidences, r => Assert.True(r.MoveInDate < r.MoveOutDate));
    }
}
