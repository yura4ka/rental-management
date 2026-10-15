using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Services.Applications;
using RentalManagement.Api.Validation;

namespace RentalManagement.UnitTests;

public sealed class ApplicationRulesTests
{
    [Fact]
    public void EveryStatusActionPairHasExactlyTheSpecifiedTransition()
    {
        var allowed = new Dictionary<(ApplicationStatus, ApplicationAction), ApplicationStatus>
        {
            [(ApplicationStatus.Draft, ApplicationAction.Submit)] = ApplicationStatus.Submitted,
            [(ApplicationStatus.Returned, ApplicationAction.Submit)] = ApplicationStatus.Submitted,
            [(ApplicationStatus.Submitted, ApplicationAction.StartReview)] = ApplicationStatus.InReview,
            [(ApplicationStatus.InReview, ApplicationAction.Release)] = ApplicationStatus.Submitted,
            [(ApplicationStatus.InReview, ApplicationAction.Return)] = ApplicationStatus.Returned,
            [(ApplicationStatus.InReview, ApplicationAction.Deny)] = ApplicationStatus.Denied,
            [(ApplicationStatus.InReview, ApplicationAction.Approve)] = ApplicationStatus.Approved
        };
        foreach (var status in Enum.GetValues<ApplicationStatus>())
        {
            if (ApplicationRules.IsOpen(status)) allowed[(status, ApplicationAction.Withdraw)] = ApplicationStatus.Withdrawn;
            foreach (var action in Enum.GetValues<ApplicationAction>())
                if (allowed.TryGetValue((status, action), out var target))
                    Assert.Equal(target, ApplicationRules.Transition(status, action));
                else
                    Assert.Equal(409, Assert.Throws<ApiException>(() => ApplicationRules.Transition(status, action)).Status);
        }
    }

    [Fact]
    public void InformationRequiresAllFieldsAndChecksRawCeilingsBeforeCleaning()
    {
        var missing = Assert.Throws<ApiException>(() => ApplicationValidation.Information(new(null, null, null, null)));
        Assert.Equal(422, missing.Status);
        Assert.Equal(4, missing.Fields!.Count);
        Assert.Throws<ApiException>(() => ApplicationValidation.Information(ValidInfo() with { Name = new string(' ', 101) + "A" }));
        Assert.Throws<ApiException>(() => ApplicationValidation.Information(ValidInfo() with { Phone = "1234567890" }));
        Assert.Throws<ApiException>(() => ApplicationValidation.Information(ValidInfo() with { ContactEmail = "Name <a@example.com>" }));
        var clean = ApplicationValidation.Information(ValidInfo() with { Name = " Alice ", CurrentAddress = new(" ", " Street ", " ") });
        Assert.Equal("Alice", clean.Name);
        Assert.Equal(new ProfileAddress(null, "Street", null), clean.CurrentAddress);
    }

    [Fact]
    public void ResidenceHistoryAcceptsSavedEmptyButRejectsMissingAndInvalidDates()
    {
        var today = new DateOnly(2026, 10, 15);
        Assert.Empty(ApplicationValidation.Residences(new(1, []), today));
        Assert.Throws<ApiException>(() => ApplicationValidation.Residences(new(1, null), today));
        Assert.Throws<ApiException>(() => ApplicationValidation.Residences(new(1, [null]), today));
        var row = new ResidenceInput(new(null, "Street", null), "Owner", "123-456-7890", "2020-01-01T00:00:00Z", "2021-01-01T00:00:00Z");
        Assert.Single(ApplicationValidation.Residences(new(1, [row]), today));
        foreach (var end in new[] { "2020-01-01T00:00:00Z", "2026-10-16T00:00:00Z", "2021-01-01", "2021-01-01T01:00:00Z" })
            Assert.Throws<ApiException>(() => ApplicationValidation.Residences(new(1, [row with { MoveOutDate = end }]), today));
        Assert.Throws<ApiException>(() => ApplicationValidation.Residences(new(1, [row with { LandlordName = " " }]), today));
    }

    [Fact]
    public void QueryValidationRejectsUnsupportedValuesAndApplicantArchiveToggle()
    {
        Assert.Null(ApplicationValidation.Query(new(), false));
        Assert.Equal(ApplicationStatus.Returned, ApplicationValidation.Query(new() { Status = "Returned" }, true));
        foreach (var query in new ApplicationListQuery[]
        {
            new() { Page = 0 }, new() { Page = int.MaxValue }, new() { SortBy = "name" },
            new() { SortDirection = "DESC" }, new() { Status = "1" }, new() { Status = "draft" }
        }) Assert.Throws<ApiException>(() => ApplicationValidation.Query(query, true));
        Assert.Throws<ApiException>(() => ApplicationValidation.Query(new() { ShowArchived = true }, false));
    }

    [Fact]
    public void CommentsHaveRawLengthLimitsAndNonblankRequiredValues()
    {
        Assert.Null(ApplicationValidation.Comment(" ", false));
        Assert.Equal("Reason", ApplicationValidation.Comment(" Reason ", true));
        Assert.Equal(2000, ApplicationValidation.Comment(new string('x', 2000), true)!.Length);
        Assert.Throws<ApiException>(() => ApplicationValidation.Comment(" ", true));
        Assert.Throws<ApiException>(() => ApplicationValidation.Comment(new string(' ', 2001), false));
    }

    [Fact]
    public void NotesRequireExplicitNullOrDecimalStringVersion()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { VersionJsonConverter.Configure } }
        };
        Assert.Null(JsonSerializer.Deserialize<SaveManagerNoteRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":null,"body":""}"""), options)!.ExpectedVersion);
        var note = JsonSerializer.Deserialize<SaveManagerNoteRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":"9007199254740993","body":"note"}"""), options)!;
        Assert.Equal(9007199254740993L, note.ExpectedVersion);
        Assert.Contains("\"expectedVersion\":\"9007199254740993\"", JsonSerializer.Serialize(note, options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SaveManagerNoteRequest>(OperationTestJson.WithMetadata("""{"body":"note"}"""), options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SaveManagerNoteRequest>(OperationTestJson.WithMetadata("""{"expectedVersion":1,"body":"note"}"""), options));
    }

    private static ApplicantInformation ValidInfo() => new("Alice", "123-456-7890", "alice@example.com", new(null, "Street", null));
}
