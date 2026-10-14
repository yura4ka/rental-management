using System.Diagnostics;

namespace RentalManagement.Api.Infrastructure;

public sealed class ApiErrorMiddleware(RequestDelegate next, ILogger<ApiErrorMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var started = Stopwatch.GetTimestamp();
        string? code = null;
        try
        {
            await next(context);
        }
        catch (ApiException exception) when (!context.Response.HasStarted)
        {
            code = exception.Code;
            context.Response.Clear();
            context.Response.StatusCode = exception.Status;
            await context.Response.WriteAsJsonAsync(
                ApiProblems.Create(exception.Status, exception.Code, exception.Title, exception.Fields),
                options: null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
        }
        catch (BadHttpRequestException exception) when (!context.Response.HasStarted)
        {
            code = "MalformedRequest";
            context.Response.Clear();
            context.Response.StatusCode = exception.StatusCode;
            await context.Response.WriteAsJsonAsync(
                ApiProblems.Create(exception.StatusCode, code, "Malformed request."),
                options: null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            context.Response.StatusCode = 499;
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            code = "UnexpectedError";
            // Exception messages (including SQL uniqueness errors) can contain personal data.
            logger.LogError("Unhandled {ExceptionType}; stack {StackTrace}",
                exception.GetType().FullName, exception.StackTrace);
            context.Response.Clear();
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(ApiProblems.Create(500, code, "An unexpected error occurred."),
                options: null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
        }
        finally
        {
            // Endpoint display name is static; never log paths, query strings, tokens or bodies.
            logger.LogInformation("Request {Endpoint} completed in {DurationMs} ms with {HttpStatus} and {ErrorCode}",
                context.GetEndpoint()?.DisplayName, Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                context.Response.StatusCode, code);
        }
    }
}
