using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalManagement.Api.Contracts.Auth;
using RentalManagement.Api.Services;

namespace RentalManagement.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Authorize]
[Tags("Auth")]
public sealed class AuthController(AccountService accounts) : ControllerBase
{
    [HttpPost("signup")]
    [AllowAnonymous]
    [ProducesResponseType<AccountResponse>(StatusCodes.Status201Created, "application/json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<ActionResult<AccountResponse>> Signup(SignupRequest request, CancellationToken cancellationToken)
    {
        var account = await accounts.SignupAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, account);
    }

    [HttpGet("me")]
    [ProducesResponseType<CurrentAccountResponse>(StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<ActionResult<CurrentAccountResponse>> Me(CancellationToken cancellationToken) =>
        Ok(await accounts.MeAsync(User, cancellationToken));

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(void), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<IActionResult> Logout()
    {
        await accounts.LogoutAsync(User);
        return NoContent();
    }
}
