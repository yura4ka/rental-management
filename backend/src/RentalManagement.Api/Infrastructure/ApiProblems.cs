using Microsoft.AspNetCore.Mvc;

namespace RentalManagement.Api.Infrastructure;

public static class ApiProblems
{
    public static ProblemDetails Create(int status, string code, string title,
        IReadOnlyDictionary<string, string>? fields = null)
    {
        var problem = new ProblemDetails { Type = "about:blank", Status = status, Title = title };
        problem.Extensions["code"] = code;
        if (fields is not null)
            problem.Extensions["validation"] = new { fields };
        return problem;
    }

    public static ObjectResult Result(int status, string code, string title,
        IReadOnlyDictionary<string, string>? fields = null) => new(Create(status, code, title, fields))
        { StatusCode = status, ContentTypes = { "application/problem+json" } };
}
