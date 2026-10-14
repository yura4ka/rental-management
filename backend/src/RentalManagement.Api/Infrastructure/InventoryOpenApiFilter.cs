using Microsoft.OpenApi;
using RentalManagement.Api.Contracts.Inventory;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace RentalManagement.Api.Infrastructure;

public sealed class InventoryOpenApiFilter : ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type == typeof(PropertyAddress))
        {
            Limit(schema, "displayName", 100);
            Limit(schema, "streetAddress", 200);
            Limit(schema, "line2", 100);
        }
        if (context.Type != typeof(CreateUnitRequest) && context.Type != typeof(UpdateUnitRequest) &&
            context.Type != typeof(UnitResponse)) return;
        if (schema.Properties?["number"] is OpenApiSchema number)
        {
            number.MinLength = 1;
            number.MaxLength = 20;
            number.Pattern = "^[A-Z0-9_-]{1,20}$";
            number.Description = "Case-sensitive; rejected rather than trimmed or uppercased. Unique within the property, including archived units.";
        }
        if (schema.Properties?["monthlyRentCents"] is OpenApiSchema rent)
        {
            rent.Minimum = "1";
            rent.Maximum = "999999999999";
            rent.Description = "Monthly USD rent in integer cents, not floating-point dollars.";
        }
        if (schema.Properties?["bedrooms"] is OpenApiSchema bedrooms) bedrooms.Minimum = "0";
    }

    private static void Limit(IOpenApiSchema schema, string name, int max)
    {
        if (schema.Properties?[name] is OpenApiSchema property) property.MaxLength = max;
    }
}
