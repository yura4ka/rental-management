using Microsoft.AspNetCore.Authentication.BearerToken;
using System.Text.Json.Serialization.Metadata;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.OpenApi;
using RentalManagement.Api.Auth;
using RentalManagement.Api.Contracts.Auth;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Contracts.Profiles;
using RentalManagement.Api.Persistence;
using RentalManagement.Api.Persistence.Seeding;
using RentalManagement.Api.Services;
using RentalManagement.Api.Services.Auth;
using RentalManagement.Api.Services.Profiles;
using RentalManagement.Api.Validation;

namespace RentalManagement.Api.Infrastructure;

public static class ServiceConfiguration
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration config,
        IHostEnvironment environment)
    {
        var connectionString = config.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Set ConnectionStrings:DefaultConnection through user secrets or environment configuration.");
        services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
        services.AddScoped<DatabaseInitializer>();
        services.AddScoped<DemonstrationSeeder>();

        services.AddAuthentication(IdentityConstants.BearerScheme)
            .AddBearerToken(IdentityConstants.BearerScheme);
        services.AddIdentityCore<IdentityUser<Guid>>(options =>
        {
            options.Stores.SchemaVersion = IdentitySchemaVersions.Version1;
            options.Stores.MaxLengthForKeys = 128;
            options.User.RequireUniqueEmail = true;
            options.User.AllowedUserNameCharacters = "";
            options.Password.RequiredLength = 12;
            options.Password.RequireDigit = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredUniqueChars = 0;
            options.SignIn.RequireConfirmedEmail = false;
        })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddApiEndpoints();
        services.RemoveAll<IPasswordValidator<IdentityUser<Guid>>>();
        services.AddScoped<IPasswordValidator<IdentityUser<Guid>>, Auth.PasswordValidator>();
        var authentication = config.GetSection("Authentication").Get<AuthenticationSettings>() ?? new();
        if (authentication.AccessTokenMinutes != 15 || authentication.RefreshTokenDays != 14)
            throw new InvalidOperationException("Authentication lifetimes must be 15 minutes / 14 days per the auth contract.");
        services.Configure<BearerTokenOptions>(IdentityConstants.BearerScheme, options =>
        {
            options.BearerTokenExpiration = TimeSpan.FromMinutes(authentication.AccessTokenMinutes);
            options.RefreshTokenExpiration = TimeSpan.FromDays(authentication.RefreshTokenDays);
        });

        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder(IdentityConstants.BearerScheme)
                .RequireAuthenticatedUser().Build();
            options.AddPolicy(AccountRoles.Applicant, policy => policy.RequireRole(AccountRoles.Applicant));
            options.AddPolicy(AccountRoles.PropertyManager, policy => policy.RequireRole(AccountRoles.PropertyManager));
        });
        ConfigureDataProtection(services, config, environment);
        services.AddScoped<AccountService>();
        services.TryAddSingleton<TimeProvider>(TimeProvider.System);
        services.AddScoped<ApplicantProfileService>();
        services.AddScoped<InventoryService>();
        services.AddScoped<ApplicationService>();
        services.AddScoped<IValidator<CreatePropertyRequest>, CreatePropertyRequestValidator>();
        services.AddScoped<IValidator<UpdatePropertyRequest>, UpdatePropertyRequestValidator>();
        services.AddScoped<IValidator<CreateUnitRequest>, CreateUnitRequestValidator>();
        services.AddScoped<IValidator<UpdateUnitRequest>, UpdateUnitRequestValidator>();
        services.AddScoped<IValidator<ArchiveInventoryRequest>, ArchiveInventoryRequestValidator>();
        services.AddScoped<IValidator<ApplicantInformationRequest>, ApplicantInformationRequestValidator>();
        services.AddScoped<IValidator<ApplicantInformationCommand>, ApplicantInformationCommandValidator>();
        services.AddScoped<IValidator<ResidenceHistoryRequest>, ResidenceHistoryRequestValidator>();
        services.AddScoped<IValidator<ResidenceHistoryCommand>, ResidenceHistoryCommandValidator>();
        services.AddScoped<IValidator<SignupRequest>, SignupRequestValidator>();
        services.AddScoped<IValidator<SignupCommand>, SignupCommandValidator>();
        services.AddControllers().AddJsonOptions(options =>
            options.JsonSerializerOptions.TypeInfoResolver = new DefaultJsonTypeInfoResolver
            {
                Modifiers = { VersionJsonConverter.Configure }
            });
        services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolver = new DefaultJsonTypeInfoResolver
            {
                Modifiers = { VersionJsonConverter.Configure }
            });
        services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
        services.Configure<ApiBehaviorOptions>(options => options.InvalidModelStateResponseFactory = _ =>
            ApiProblems.Result(400, "MalformedRequest", "Malformed request."));
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "Rental Management API", Version = "v1" });
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http, Scheme = "bearer",
                Description = "Paste the opaque Identity access token, without a Bearer prefix."
            });
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = []
            });
            options.OperationFilter<AuthOpenApiFilter>();
            options.SchemaFilter<VersionOpenApiFilter>();
            options.SchemaFilter<ProfileOpenApiFilter>();
            options.SchemaFilter<InventoryOpenApiFilter>();
            options.SchemaFilter<ApplicationOpenApiFilter>();
        });
        return services;
    }

    private static void ConfigureDataProtection(IServiceCollection services, IConfiguration config, IHostEnvironment environment)
    {
        var applicationName = config["DataProtection:ApplicationName"];
        var configuredPath = config["DataProtection:KeyPath"];
        if (string.IsNullOrWhiteSpace(applicationName) || string.IsNullOrWhiteSpace(configuredPath))
            throw new InvalidOperationException("Configure a stable DataProtection:ApplicationName and persistent DataProtection:KeyPath.");
        var path = Path.GetFullPath(configuredPath, environment.ContentRootPath);
        if (OperatingSystem.IsWindows()) Directory.CreateDirectory(path);
        else
        {
            Directory.CreateDirectory(path, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            var mode = File.GetUnixFileMode(path);
            if ((mode & (UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.GroupExecute |
                         UnixFileMode.OtherRead | UnixFileMode.OtherWrite | UnixFileMode.OtherExecute)) != 0)
                throw new InvalidOperationException("Data Protection key directory must be private to the API user (chmod 700).");
        }
        services.AddDataProtection().SetApplicationName(applicationName).PersistKeysToFileSystem(new DirectoryInfo(path));
    }
}
