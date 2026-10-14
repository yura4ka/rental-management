using System.Text.Json;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Services.Profiles;
using RentalManagement.Api.Validation;

namespace RentalManagement.UnitTests;

public sealed class ProfileValidationTests
{
    private readonly ResidenceHistoryCommandValidator residences = new(new FixedClock());

    [Fact]
    public async Task IncompleteContactIsAllowedAndBlanksBecomeNull()
    {
        var command = ApplicantInformationCommand.FromRequest(new(1, new("  ", "\t", "", new(" ", null, ""))));
        Assert.True((await new ApplicantInformationCommandValidator().ValidateAsync(command)).IsValid);
        Assert.Equal(new ApplicantInformation(null, null, null, new(null, null, null)), command.ApplicantInformation);
    }

    [Theory]
    [InlineData("1234567890")]
    [InlineData("123-456-7890\nextra")]
    [InlineData("１２３-456-7890")]
    public async Task ContactRejectsInvalidPhones(string phone)
    {
        var result = await new ApplicantInformationCommandValidator().ValidateAsync(new ApplicantInformationCommand(1, new(null, phone, null, null)));
        Assert.Contains(result.Errors, e => e.PropertyName == "applicantInformation.phone");
    }

    [Theory]
    [InlineData("not-email")]
    [InlineData("Name <person@example.com>")]
    public async Task ContactRejectsInvalidEmail(string email)
    {
        var result = await new ApplicantInformationCommandValidator().ValidateAsync(new ApplicantInformationCommand(1, new(null, null, email, null)));
        Assert.Contains(result.Errors, e => e.PropertyName == "applicantInformation.contactEmail");
    }

    [Fact]
    public async Task RawInputCeilingsApplyBeforeTrimming()
    {
        var request = new ApplicantInformationRequest(1, new(new string(' ', 101), new string(' ', 51),
            new string(' ', 255), new(new string(' ', 101), new string(' ', 201), new string(' ', 101))));
        var result = await new ApplicantInformationRequestValidator().ValidateAsync(request);
        Assert.Equal(6, result.Errors.Count);
        Assert.True((await new ApplicantInformationCommandValidator().ValidateAsync(ApplicantInformationCommand.FromRequest(request))).IsValid);
    }

    [Fact]
    public async Task EmptyResidenceListIsValidButMissingSectionAndEntriesAreNot()
    {
        Assert.True((await residences.ValidateAsync(new ResidenceHistoryCommand(1, []))).IsValid);
        Assert.False((await residences.ValidateAsync(new ResidenceHistoryCommand(1, null))).IsValid);
        Assert.False((await residences.ValidateAsync(new ResidenceHistoryCommand(1, [null]))).IsValid);
        Assert.False((await new ApplicantInformationCommandValidator().ValidateAsync(new ApplicantInformationCommand(1, null))).IsValid);
    }

    [Fact]
    public async Task ResidencesRequireStreetAndLandlordFields()
    {
        var result = await residences.ValidateAsync(new ResidenceHistoryCommand(1, [new(null, null, null, "2020-01-01T00:00:00Z", "2021-01-01T00:00:00Z")]));
        Assert.Equal(3, result.Errors.Count);
        Assert.Contains(result.Errors, e => e.PropertyName == "residenceHistory[0].address.streetAddress");
    }

    [Theory]
    [InlineData("2020-01-01", "2021-01-01T00:00:00Z")]
    [InlineData("2020-01-01T00:00:00+00:00", "2021-01-01T00:00:00Z")]
    [InlineData("2020-02-30T00:00:00Z", "2021-01-01T00:00:00Z")]
    [InlineData("2020-01-01T01:00:00Z", "2021-01-01T00:00:00Z")]
    [InlineData("2021-01-01T00:00:00Z", "2021-01-01T00:00:00Z")]
    [InlineData("2022-01-01T00:00:00Z", "2021-01-01T00:00:00Z")]
    [InlineData("2020-01-01T00:00:00Z", "2026-10-15T00:00:00Z")]
    [InlineData("2026-10-15T00:00:00Z", "2026-10-16T00:00:00Z")]
    public async Task ResidenceRejectsInvalidDates(string moveIn, string moveOut) =>
        Assert.False((await residences.ValidateAsync(new ResidenceHistoryCommand(1, [Row(moveIn, moveOut)]))).IsValid);

    [Fact]
    public async Task TodayAndLeapDatesAreAccepted() =>
        Assert.True((await residences.ValidateAsync(new ResidenceHistoryCommand(1, [Row("2024-02-29T00:00:00Z", "2026-10-14T00:00:00Z")]))).IsValid);

    [Fact]
    public async Task VersionsMustBePositive()
    {
        Assert.False((await residences.ValidateAsync(new ResidenceHistoryCommand(0, []))).IsValid);
        Assert.False((await new ApplicantInformationCommandValidator().ValidateAsync(new ApplicantInformationCommand(0, new(null, null, null, null)))).IsValid);
    }

    [Fact]
    public void VersionsAreDecimalStringsAndRejectNumericJson()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            TypeInfoResolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver
                { Modifiers = { VersionJsonConverter.Configure } }
        };
        var request = JsonSerializer.Deserialize<ResidenceHistoryRequest>("{\"expectedVersion\":\"9007199254740993\",\"residenceHistory\":[]}", options)!;
        Assert.Equal(9007199254740993L, request.ExpectedVersion);
        Assert.Contains("\"expectedVersion\":\"9007199254740993\"", JsonSerializer.Serialize(request, options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ResidenceHistoryRequest>("{\"expectedVersion\":1}", options));
    }

    private static ResidenceInput Row(string moveIn, string moveOut) => new(new(null, "Street", null), "Landlord", "123-456-7890", moveIn, moveOut);
    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);
    }
}
