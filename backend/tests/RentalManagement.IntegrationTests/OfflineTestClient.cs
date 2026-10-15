using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RentalManagement.Api.Persistence;

namespace RentalManagement.IntegrationTests;

// Existing workflow tests issue a new intention per call. Protocol/replay tests use an unmodified client.
internal sealed class OfflineTestClient(Guid generation) : DelegatingHandler
{
    internal static async Task<HttpClient> CreateAsync(WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var generation = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>()
            .DatabaseMetadata.Select(m => m.EnvironmentGeneration).SingleAsync();
        return new HttpClient(new OfflineTestClient(generation) { InnerHandler = app.GetTestServer().CreateHandler() })
        {
            BaseAddress = new Uri("http://localhost")
        };
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var path = request.RequestUri!.AbsolutePath;
        if (request.Content is not null && !path.StartsWith("/api/auth/", StringComparison.Ordinal) &&
            (request.Method == HttpMethod.Post || request.Method == HttpMethod.Put))
        {
            JsonObject? body = null;
            try { body = JsonNode.Parse(await request.Content.ReadAsStringAsync(ct)) as JsonObject; }
            catch (JsonException) { }
            if (body is not null)
            {
                Supply("operationId", Guid.CreateVersion7());
                Supply("environmentGeneration", generation);
                if (request.Method == HttpMethod.Post && (path == "/api/properties" || path.EndsWith("/units", StringComparison.Ordinal)))
                    Supply("id", Guid.CreateVersion7());
                var original = request.Content;
                request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
                original.Dispose();

                void Supply(string name, Guid value)
                {
                    if (body[name] is null || body[name]!.GetValue<string>() == Guid.Empty.ToString("D"))
                        body[name] = value.ToString("D");
                }
            }
        }
        return await base.SendAsync(request, ct);
    }
}
