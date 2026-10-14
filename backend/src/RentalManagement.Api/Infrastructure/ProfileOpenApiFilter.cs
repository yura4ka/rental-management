using Microsoft.OpenApi;
using RentalManagement.Api.Contracts.Profiles;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace RentalManagement.Api.Infrastructure;

public sealed class ProfileOpenApiFilter : ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type != typeof(ResidenceInput) && context.Type != typeof(ResidenceResponse)) return;
        foreach (var name in new[] { "moveInDate", "moveOutDate" })
        {
            if (schema.Properties?.TryGetValue(name, out var property) != true || property is not OpenApiSchema date) continue;
            date.Pattern = @"^[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00:00Z$";
            date.Description = "Calendar date encoded at UTC midnight as YYYY-MM-DDT00:00:00Z; do not convert device timezones.";
        }
    }
}
