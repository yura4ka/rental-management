using RentalManagement.Api.Auth;
using RentalManagement.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApplication(builder.Configuration, builder.Environment);

var app = builder.Build();
app.UseMiddleware<ApiErrorMiddleware>();
app.UseStatusCodePages(async statusContext =>
{
    var context = statusContext.HttpContext;
    // Preserve the framework's native login/refresh responses (including empty refresh 401).
    if (context.GetEndpoint() is RouteEndpoint route &&
        route.RoutePattern.RawText is "/api/auth/login" or "/api/auth/refresh") return;
    var status = context.Response.StatusCode;
    var (code, title) = status switch
    {
        400 => ("MalformedRequest", "Malformed request."),
        401 => ("Unauthenticated", "Authentication required."),
        403 => ("Forbidden", "Action is forbidden."),
        404 => ("NotFound", "Resource not found."),
        405 => ("MethodNotAllowed", "HTTP method is not supported."),
        _ => ("RequestFailed", "Request could not be completed.")
    };
    await context.Response.WriteAsJsonAsync(ApiProblems.Create(status, code, title),
        options: null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
if (app.Configuration.GetValue<bool>("Api:RequireHttps")) app.UseHttpsRedirection();

app.UseAuthentication();
app.Use(async (context, next) =>
{
    if (context.GetEndpoint() is null)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next(context);
});
app.UseAuthorization();
app.MapControllers();
app.MapApprovedIdentityEndpoints();
app.Run();
