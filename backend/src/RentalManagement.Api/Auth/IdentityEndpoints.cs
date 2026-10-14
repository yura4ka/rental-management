using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.Extensions.Primitives;

namespace RentalManagement.Api.Auth;

public static class IdentityEndpoints
{
    public static void MapApprovedIdentityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Map framework handlers in an isolated builder. Only approved endpoints are published
        // to the application's routing data sources; unsupported routes do not exist at runtime.
        var isolated = new IsolatedRouteBuilder(endpoints);
        var group = isolated.MapGroup("/api/auth").WithTags("Auth").AllowAnonymous();
        group.AddEndpointFilter(async (context, next) =>
        {
            for (var i = 0; i < context.Arguments.Count; i++)
            {
                if (context.Arguments[i] is not LoginRequest login) continue;
                if (context.HttpContext.Request.Query.ContainsKey("useCookies") ||
                    context.HttpContext.Request.Query.ContainsKey("useSessionCookies"))
                    return Results.Problem(statusCode: 400, title: "Cookie login is not supported.");

                if (login.Email is null || login.Password is null)
                    return Results.Problem(statusCode: 400, title: "Email and password are required.");

                context.Arguments[i] = new LoginRequest
                {
                    Email = login.Email.Trim(),
                    Password = login.Password,
                    TwoFactorCode = login.TwoFactorCode,
                    TwoFactorRecoveryCode = login.TwoFactorRecoveryCode
                };
            }
            return await next(context);
        });
        group.MapIdentityApi<IdentityUser<Guid>>();
        foreach (var source in isolated.DataSources)
            endpoints.DataSources.Add(new ApprovedIdentityDataSource(source));
    }

    private sealed class IsolatedRouteBuilder(IEndpointRouteBuilder parent) : IEndpointRouteBuilder
    {
        public IServiceProvider ServiceProvider => parent.ServiceProvider;
        public ICollection<EndpointDataSource> DataSources { get; } = new List<EndpointDataSource>();
        public IApplicationBuilder CreateApplicationBuilder() => parent.CreateApplicationBuilder();
    }

    private sealed class ApprovedIdentityDataSource(EndpointDataSource source) : EndpointDataSource
    {
        public override IReadOnlyList<Endpoint> Endpoints => source.Endpoints.Where(endpoint =>
            endpoint is RouteEndpoint route &&
            route.RoutePattern.RawText is "/api/auth/login" or "/api/auth/refresh" &&
            endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.SequenceEqual(["POST"]) == true)
            .ToArray();

        public override IChangeToken GetChangeToken() => source.GetChangeToken();
    }
}
