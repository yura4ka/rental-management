using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Infrastructure;
using RentalManagement.Api.Operations;
using RentalManagement.Api.Operations.Authorization;
using RentalManagement.Api.Persistence;

namespace RentalManagement.UnitTests;

public sealed class OperationAuthorizationTests
{
    private static readonly Guid AccountId = Guid.NewGuid();

    [Fact]
    public async Task DispatcherSelectsOnlyTheMatchingHandlerAndForwardsAccountScopeAndCancellation()
    {
        var property = new RecordingAuthorizer(ResourceType.Property);
        var unit = new RecordingAuthorizer(ResourceType.Unit);
        var authorization = new OperationAuthorization([property, unit]);
        var scope = new AuthorizationScope(ResourceType.Unit, Guid.NewGuid(), ResourceAccess.Owner);
        using var cancellation = new CancellationTokenSource();

        await authorization.CheckAsync(Principal(AccountRoles.PropertyManager), scope, cancellation.Token);

        Assert.Equal(0, property.Calls);
        Assert.Equal(1, unit.Calls);
        Assert.Equal(AccountId, unit.Account);
        Assert.Same(scope, unit.Scope);
        Assert.Equal(cancellation.Token, unit.CancellationToken);
    }

    [Theory]
    [InlineData(ResourceAccess.Applicant, AccountRoles.Applicant, AccountRoles.PropertyManager)]
    [InlineData(ResourceAccess.Manager, AccountRoles.PropertyManager, AccountRoles.Applicant)]
    [InlineData(ResourceAccess.Owner, AccountRoles.PropertyManager, AccountRoles.Applicant)]
    public async Task RolesAreCheckedBeforeDispatch(ResourceAccess access, string allowedRole, string forbiddenRole)
    {
        var handler = new RecordingAuthorizer(ResourceType.Account);
        var authorization = new OperationAuthorization([handler]);
        var scope = new AuthorizationScope(ResourceType.Account, AccountId, access);

        var error = await Assert.ThrowsAsync<ApiException>(() => authorization.CheckAsync(Principal(forbiddenRole), scope, default));
        Assert.Equal(403, error.Status);
        Assert.Equal("Forbidden", error.Code);
        Assert.Equal(0, handler.Calls);
        await authorization.CheckAsync(Principal(allowedRole), scope, default);
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task MissingDuplicateAndUnsupportedHandlersFailClosed()
    {
        var handler = new RecordingAuthorizer(ResourceType.Property);
        Assert.Throws<ArgumentException>(() => new OperationAuthorization([handler, handler]));
        var authorization = new OperationAuthorization([handler]);
        var principal = Principal(AccountRoles.PropertyManager);
        await Assert.ThrowsAsync<InvalidOperationException>(() => authorization.CheckAsync(principal,
            new(ResourceType.Unit, Guid.NewGuid(), ResourceAccess.Owner), default));
        await Assert.ThrowsAsync<InvalidOperationException>(() => authorization.CheckAsync(principal,
            new(ResourceType.Property, Guid.NewGuid(), ResourceAccess.Unspecified), default));
        await Assert.ThrowsAsync<InvalidOperationException>(() => authorization.CheckAsync(principal,
            new(ResourceType.Property, Guid.NewGuid(), (ResourceAccess)999), default));
        handler.Supported = false;
        await Assert.ThrowsAsync<InvalidOperationException>(() => authorization.CheckAsync(principal,
            new(ResourceType.Property, Guid.NewGuid(), ResourceAccess.Owner), default));
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task HandlerErrorsAreNotTranslatedOrHidden()
    {
        var expected = new ApiException(404, "ResourceNotFound", "Resource not found.");
        var handler = new RecordingAuthorizer(ResourceType.Property) { Failure = expected };
        var authorization = new OperationAuthorization([handler]);
        var actual = await Assert.ThrowsAsync<ApiException>(() => authorization.CheckAsync(Principal(AccountRoles.PropertyManager),
            new(ResourceType.Property, Guid.NewGuid(), ResourceAccess.Owner), default));
        Assert.Same(expected, actual);
    }

    [Fact]
    public async Task ResourceHandlersRejectWrongTypesAndUnsupportedAccessBeforeAnyDatabaseQueries()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=True").Options);
        IOperationScopeAuthorizer[] handlers =
        [
            new AccountScopeAuthorizer(db), new PropertyScopeAuthorizer(db),
            new UnitScopeAuthorizer(db), new ApplicationScopeAuthorizer(db)
        ];
        var allowed = new Dictionary<ResourceType, ResourceAccess[]>
        {
            [ResourceType.Account] = [ResourceAccess.Applicant, ResourceAccess.Manager],
            [ResourceType.Property] = [ResourceAccess.Owner],
            [ResourceType.Unit] = [ResourceAccess.Applicant, ResourceAccess.Owner],
            [ResourceType.Application] = [ResourceAccess.Applicant, ResourceAccess.Manager, ResourceAccess.Owner]
        };
        foreach (var handler in handlers)
        {
            foreach (var access in Enum.GetValues<ResourceAccess>().Append((ResourceAccess)999))
            {
                var supported = allowed[handler.ResourceType].Contains(access);
                Assert.Equal(supported, handler.Supports(access));
                if (!supported)
                    await Assert.ThrowsAsync<InvalidOperationException>(() => handler.CheckAsync(AccountId,
                        new(handler.ResourceType, Guid.NewGuid(), access), default));
            }
            await Assert.ThrowsAsync<InvalidOperationException>(() => handler.CheckAsync(AccountId,
                new(ResourceType.Unspecified, Guid.NewGuid(), allowed[handler.ResourceType][0]), default));
        }
        // Account mismatch is rejected without querying or revealing another account's existence.
        var mismatch = await Assert.ThrowsAsync<ApiException>(() => handlers[0].CheckAsync(AccountId,
            new(ResourceType.Account, Guid.NewGuid(), ResourceAccess.Applicant), default));
        Assert.Equal(404, mismatch.Status);
    }

    [Fact]
    public void ScopedRegistrationsCoverAllInitialAndAcceptedEndpointAuthorizationScopes()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer("Server=unused;Database=unused;Integrated Security=True"));
        services.AddOperationAuthorization();
        Assert.All(services.Where(d => d.ServiceType == typeof(IOperationScopeAuthorizer) ||
            d.ServiceType == typeof(OperationAuthorization)), d => Assert.Equal(ServiceLifetime.Scoped, d.Lifetime));
        using var provider = services.BuildServiceProvider(validateScopes: true);
        using var first = provider.CreateScope();
        using var second = provider.CreateScope();
        var handlers = first.ServiceProvider.GetServices<IOperationScopeAuthorizer>().ToDictionary(h => h.ResourceType);
        Assert.Equal(4, handlers.Count);
        var authorization = first.ServiceProvider.GetRequiredService<OperationAuthorization>();
        Assert.Same(authorization, first.ServiceProvider.GetRequiredService<OperationAuthorization>());
        Assert.NotSame(authorization, second.ServiceProvider.GetRequiredService<OperationAuthorization>());
        foreach (var handler in first.ServiceProvider.GetServices<IOperationScopeAuthorizer>())
            Assert.Same(handlers[handler.ResourceType], handler);

        var metadata = typeof(PropertiesController).Assembly.GetTypes()
            .Where(t => t.BaseType == typeof(Microsoft.AspNetCore.Mvc.ControllerBase))
            .SelectMany(t => t.GetMethods())
            .SelectMany(m => m.GetCustomAttributes(false).OfType<BusinessCommandAttribute>()).ToArray();
        Assert.NotEmpty(metadata);
        foreach (var command in metadata)
        {
            Assert.True(handlers[command.Scope].Supports(command.Access), command.CommandType);
            if (command.AcceptedScope != ResourceType.Unspecified)
                Assert.True(handlers[command.AcceptedScope].Supports(command.AcceptedAccess), command.CommandType);
        }
    }

    private static ClaimsPrincipal Principal(string role) => new(new ClaimsIdentity(
        [new Claim(ClaimTypes.NameIdentifier, AccountId.ToString("D")), new Claim(ClaimTypes.Role, role)], "Test"));

    private sealed class RecordingAuthorizer(ResourceType resourceType) : IOperationScopeAuthorizer
    {
        public ResourceType ResourceType => resourceType;
        public bool Supported { get; set; } = true;
        public bool Supports(ResourceAccess access) => Supported;
        public int Calls { get; private set; }
        public Guid Account { get; private set; }
        public AuthorizationScope? Scope { get; private set; }
        public CancellationToken CancellationToken { get; private set; }
        public Exception? Failure { get; init; }

        public Task CheckAsync(Guid accountId, AuthorizationScope scope, CancellationToken ct)
        {
            Calls++;
            Account = accountId;
            Scope = scope;
            CancellationToken = ct;
            return Failure is null ? Task.CompletedTask : Task.FromException(Failure);
        }
    }
}
