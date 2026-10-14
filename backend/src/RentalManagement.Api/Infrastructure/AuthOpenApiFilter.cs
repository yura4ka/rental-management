using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace RentalManagement.Api.Infrastructure;

public sealed class AuthOpenApiFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (context.ApiDescription.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
            operation.Security = [];
        if (context.ApiDescription.RelativePath != "api/auth/login") return;
        operation.Parameters = operation.Parameters?.Where(p => p.Name is not "useCookies" and not "useSessionCookies").ToList();
        operation.Description = "Standard Identity opaque Bearer login. Cookie query flags are rejected. Email is trimmed; password is never trimmed.";
    }
}
