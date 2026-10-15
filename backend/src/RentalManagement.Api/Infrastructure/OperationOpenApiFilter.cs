using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Contracts.Profiles;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace RentalManagement.Api.Infrastructure;

public sealed class OperationOpenApiFilter : ISchemaFilter, IOperationFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema is not OpenApiSchema concrete || schema.Properties is null) return;
        if (typeof(OperationRequest).IsAssignableFrom(context.Type))
        {
            concrete.Required ??= new HashSet<string>();
            concrete.Required.Add("operationId");
            concrete.Required.Add("environmentGeneration");
            if (schema.Properties.ContainsKey("expectedVersion")) concrete.Required.Add("expectedVersion");
            if (schema.Properties.ContainsKey("id")) concrete.Required.Add("id");
            if (schema.Properties["operationId"] is OpenApiSchema operationId)
                operationId.Description = "UUIDv7, persisted before transport. Identical replay returns the original outcome; changed intent conflicts.";
            if (schema.Properties["environmentGeneration"] is OpenApiSchema generation)
                generation.Description = "Generation originally obtained from /api/auth/me. Never rewrite it on queued work.";
        }
        if (context.Type == typeof(PropertyResponse) || context.Type == typeof(UnitResponse) ||
            context.Type == typeof(ApplicantProfileResponse) || context.Type == typeof(ApplicationDetailResponse) ||
            context.Type == typeof(ManagerNoteResponse) || context.Type == typeof(RejectAllApplicationsResponse))
        {
            concrete.Properties!["operationId"] = new OpenApiSchema { Type = JsonSchemaType.String, Format = "uuid", Description = "Present on mutation acknowledgements only." };
            concrete.Properties["outcome"] = new OpenApiSchema { Type = JsonSchemaType.String, Description = "Accepted; present on mutation acknowledgements only." };
            concrete.Properties["affectedResources"] = new OpenApiSchema
            {
                Type = JsonSchemaType.Array,
                Items = context.SchemaGenerator.GenerateSchema(typeof(AffectedResource), context.SchemaRepository),
                Description = "Projection invalidation metadata, not complete detail snapshots. Present on mutations only."
            };
        }
    }

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (!context.MethodInfo.GetParameters().Any(p => typeof(OperationRequest).IsAssignableFrom(p.ParameterType))) return;
        operation.Description = (operation.Description ?? "") +
            " Requires operationId and environmentGeneration. Success/rejection replay preserves the original JSON body. " +
            "Non-receipted OperationIdConflict and EnvironmentGenerationMismatch errors require explicit recovery. " +
            "Reject-all retains execution-time selection without expectedVersion.";
        operation.Responses ??= new OpenApiResponses();
        foreach (var (status, description) in new[] { ("400", "Malformed command"), ("409", "Business conflict, operation ID conflict, or generation mismatch"), ("503", "Transient failure; retry identically") })
            operation.Responses.TryAdd(status, new OpenApiResponse
            {
                Description = description,
                Content = new Dictionary<string, OpenApiMediaType>
                {
                    ["application/problem+json"] = new() { Schema = context.SchemaGenerator.GenerateSchema(typeof(ProblemDetails), context.SchemaRepository) }
                }
            });
    }
}
