using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RentalManagement.Api.Persistence;

public sealed class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .AddUserSecrets<ApplicationDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();
        // Model/migration generation needs a provider, not a live server or credentials.
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(configuration.GetConnectionString("DefaultConnection") ??
                "Server=127.0.0.1;Database=RentalManagement;Integrated Security=true;Encrypt=true;TrustServerCertificate=true")
            .Options;
        return new ApplicationDbContext(options);
    }
}
