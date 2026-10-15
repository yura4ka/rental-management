using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Infrastructure;

namespace RentalManagement.Api.Operations;

// Capture the original JSON before model binding, preserving omitted-vs-null fingerprint semantics.
public sealed class CommandFilter(CommandRunner runner) : IAsyncResourceFilter, IAsyncActionFilter
{
    private static readonly object BodyKey = new();

    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        if (context.ActionDescriptor is ControllerActionDescriptor action &&
            action.Parameters.Any(p => typeof(OperationRequest).IsAssignableFrom(p.ParameterType)))
        {
            context.HttpContext.Request.EnableBuffering();
            using var reader = new StreamReader(context.HttpContext.Request.Body, leaveOpen: true);
            context.HttpContext.Items[BodyKey] = await reader.ReadToEndAsync(context.HttpContext.RequestAborted);
            context.HttpContext.Request.Body.Position = 0;
        }
        await next();
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.ActionArguments.Values.OfType<OperationRequest>().SingleOrDefault();
        if (request is null || !context.ModelState.IsValid)
        {
            await next();
            return;
        }
        JsonDocument body;
        try { body = JsonDocument.Parse((string)context.HttpContext.Items[BodyKey]!); }
        catch (JsonException) { throw new ApiException(400, "MalformedRequest", "Malformed request."); }
        using (body)
        {
            var command = CommandDescriptor.From(context, request);
            context.HttpContext.Items["OperationId"] = request.OperationId;
            context.HttpContext.Items["CommandType"] = command.CommandType;
            ActionExecutedContext? executedContext = null;
            var result = await runner.ExecuteAsync(context.HttpContext.User, command, request, body.RootElement,
                async () =>
                {
                    var executed = await next();
                    executedContext = executed;
                    if (executed.Exception is not null && !executed.ExceptionHandled)
                    {
                        executed.ExceptionHandled = true;
                        System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(executed.Exception).Throw();
                    }
                    return executed.Result ?? throw new InvalidOperationException("Command returned no result.");
                }, context.HttpContext.RequestAborted);
            if (executedContext is null) context.Result = result;
            else
            {
                executedContext.Result = result;
                executedContext.Exception = null;
                executedContext.ExceptionHandled = true;
            }
        }
    }
}
