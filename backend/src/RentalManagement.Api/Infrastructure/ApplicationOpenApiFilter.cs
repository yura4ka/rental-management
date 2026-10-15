using Microsoft.OpenApi;
using RentalManagement.Api.Contracts.Applications;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace RentalManagement.Api.Infrastructure;

public sealed class ApplicationOpenApiFilter : ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema.Properties is null) return;
        if (context.Type == typeof(SaveManagerNoteRequest) && schema is OpenApiSchema noteSchema)
        {
            noteSchema.Required ??= new HashSet<string>();
            noteSchema.Required.Add("expectedVersion");
            if (schema.Properties["expectedVersion"] is OpenApiSchema version)
            {
                version.Type = JsonSchemaType.String | JsonSchemaType.Null;
                version.Description = "Explicitly null for the first save; otherwise the current independent note version.";
            }
        }
        if (context.Type == typeof(ApplicationLeaseResponse))
            foreach (var name in new[] { "startDate", "endDateExclusive" })
                if (schema.Properties[name] is OpenApiSchema date)
                {
                    date.Pattern = @"^[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00:00Z$";
                    date.Description = "Calendar date at UTC midnight; lease end is exclusive.";
                }
        foreach (var (name, property) in schema.Properties)
            if (name is "comment" or "body" && property is OpenApiSchema text) text.MaxLength = 2000;
    }
}
