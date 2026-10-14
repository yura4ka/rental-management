using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace RentalManagement.Api.Infrastructure;

public sealed class VersionOpenApiFilter : ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema.Properties is null) return;
        foreach (var (name, property) in schema.Properties)
        {
            if (name is not "version" and not "expectedVersion" || property is not OpenApiSchema version) continue;
            version.Type = JsonSchemaType.String | (version.Type.GetValueOrDefault() & JsonSchemaType.Null);
            version.Format = null;
            version.Pattern = "^[1-9][0-9]*$";
        }
    }
}
