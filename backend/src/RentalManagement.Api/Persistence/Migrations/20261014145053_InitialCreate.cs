using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RentalManagement.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true, collation: "Latin1_General_100_BIN2"),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true, collation: "Latin1_General_100_BIN2"),
                    EmailConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DatabaseMetadata",
                columns: table => new
                {
                    SingletonId = table.Column<byte>(type: "tinyint", nullable: false),
                    EnvironmentGeneration = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InitializedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatabaseMetadata", x => x.SingletonId);
                    table.CheckConstraint("CK_DatabaseMetadata_InitializedAt_Utc", "[InitializedAt] IS NULL OR DATEPART(TZOFFSET, [InitializedAt]) = 0");
                    table.CheckConstraint("CK_DatabaseMetadata_Singleton", "[SingletonId] = 1");
                });

            migrationBuilder.CreateTable(
                name: "UnitTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false, collation: "Latin1_General_100_BIN2"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitTypes", x => x.Id);
                    table.CheckConstraint("CK_UnitTypes_Code_Nonblank", "[Code] IS NULL OR LEN(LTRIM(RTRIM([Code]))) > 0");
                    table.CheckConstraint("CK_UnitTypes_Name_Nonblank", "[Name] IS NULL OR LEN(LTRIM(RTRIM([Name]))) > 0");
                    table.CheckConstraint("CK_UnitTypes_Version", "[Version] >= 1");
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ApplicantProfiles",
                columns: table => new
                {
                    ApplicantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ContactEmail = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L),
                    CurrentAddressDisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CurrentAddressLine2 = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CurrentAddressStreetAddress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicantProfiles", x => x.ApplicantId);
                    table.CheckConstraint("CK_ApplicantProfiles_ContactEmail_Nonblank", "[ContactEmail] IS NULL OR LEN(LTRIM(RTRIM([ContactEmail]))) > 0");
                    table.CheckConstraint("CK_ApplicantProfiles_CreatedAt_Utc", "[CreatedAt] IS NULL OR DATEPART(TZOFFSET, [CreatedAt]) = 0");
                    table.CheckConstraint("CK_ApplicantProfiles_CurrentAddressDisplayName_Nonblank", "[CurrentAddressDisplayName] IS NULL OR LEN(LTRIM(RTRIM([CurrentAddressDisplayName]))) > 0");
                    table.CheckConstraint("CK_ApplicantProfiles_CurrentAddressLine2_Nonblank", "[CurrentAddressLine2] IS NULL OR LEN(LTRIM(RTRIM([CurrentAddressLine2]))) > 0");
                    table.CheckConstraint("CK_ApplicantProfiles_CurrentAddressStreetAddress_Nonblank", "[CurrentAddressStreetAddress] IS NULL OR LEN(LTRIM(RTRIM([CurrentAddressStreetAddress]))) > 0");
                    table.CheckConstraint("CK_ApplicantProfiles_Name_Nonblank", "[Name] IS NULL OR LEN(LTRIM(RTRIM([Name]))) > 0");
                    table.CheckConstraint("CK_ApplicantProfiles_Phone", "[Phone] IS NULL OR (DATALENGTH([Phone]) = 24 AND [Phone] COLLATE Latin1_General_100_BIN2 LIKE N'[0-9][0-9][0-9]-[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]')");
                    table.CheckConstraint("CK_ApplicantProfiles_Phone_Nonblank", "[Phone] IS NULL OR LEN(LTRIM(RTRIM([Phone]))) > 0");
                    table.CheckConstraint("CK_ApplicantProfiles_UpdatedAt_Utc", "[UpdatedAt] IS NULL OR DATEPART(TZOFFSET, [UpdatedAt]) = 0");
                    table.CheckConstraint("CK_ApplicantProfiles_Version", "[Version] >= 1");
                    table.ForeignKey(
                        name: "FK_ApplicantProfiles_AspNetUsers_ApplicantId",
                        column: x => x.ApplicantId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LoginProvider = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Properties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerManagerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ArchivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L),
                    DisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Line2 = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    StreetAddress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Properties", x => x.Id);
                    table.CheckConstraint("CK_Properties_ArchivedAt_Utc", "[ArchivedAt] IS NULL OR DATEPART(TZOFFSET, [ArchivedAt]) = 0");
                    table.CheckConstraint("CK_Properties_CreatedAt_Utc", "[CreatedAt] IS NULL OR DATEPART(TZOFFSET, [CreatedAt]) = 0");
                    table.CheckConstraint("CK_Properties_DisplayName_Nonblank", "[DisplayName] IS NULL OR LEN(LTRIM(RTRIM([DisplayName]))) > 0");
                    table.CheckConstraint("CK_Properties_Line2_Nonblank", "[Line2] IS NULL OR LEN(LTRIM(RTRIM([Line2]))) > 0");
                    table.CheckConstraint("CK_Properties_StreetAddress_Nonblank", "[StreetAddress] IS NULL OR LEN(LTRIM(RTRIM([StreetAddress]))) > 0");
                    table.CheckConstraint("CK_Properties_UpdatedAt_Utc", "[UpdatedAt] IS NULL OR DATEPART(TZOFFSET, [UpdatedAt]) = 0");
                    table.CheckConstraint("CK_Properties_Version", "[Version] >= 1");
                    table.ForeignKey(
                        name: "FK_Properties_AspNetUsers_OwnerManagerId",
                        column: x => x.OwnerManagerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ProfileResidences",
                columns: table => new
                {
                    ApplicantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    LandlordName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LandlordPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MoveInDate = table.Column<DateOnly>(type: "date", nullable: false),
                    MoveOutDate = table.Column<DateOnly>(type: "date", nullable: false),
                    AddressDisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AddressLine2 = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AddressStreetAddress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfileResidences", x => new { x.ApplicantId, x.Position });
                    table.CheckConstraint("CK_ProfileResidences_AddressDisplayName_Nonblank", "[AddressDisplayName] IS NULL OR LEN(LTRIM(RTRIM([AddressDisplayName]))) > 0");
                    table.CheckConstraint("CK_ProfileResidences_AddressLine2_Nonblank", "[AddressLine2] IS NULL OR LEN(LTRIM(RTRIM([AddressLine2]))) > 0");
                    table.CheckConstraint("CK_ProfileResidences_AddressStreetAddress_Nonblank", "[AddressStreetAddress] IS NULL OR LEN(LTRIM(RTRIM([AddressStreetAddress]))) > 0");
                    table.CheckConstraint("CK_ProfileResidences_Dates", "[MoveInDate] < [MoveOutDate]");
                    table.CheckConstraint("CK_ProfileResidences_LandlordName_Nonblank", "[LandlordName] IS NULL OR LEN(LTRIM(RTRIM([LandlordName]))) > 0");
                    table.CheckConstraint("CK_ProfileResidences_LandlordPhone", "[LandlordPhone] IS NULL OR (DATALENGTH([LandlordPhone]) = 24 AND [LandlordPhone] COLLATE Latin1_General_100_BIN2 LIKE N'[0-9][0-9][0-9]-[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]')");
                    table.CheckConstraint("CK_ProfileResidences_LandlordPhone_Nonblank", "[LandlordPhone] IS NULL OR LEN(LTRIM(RTRIM([LandlordPhone]))) > 0");
                    table.CheckConstraint("CK_ProfileResidences_Position", "[Position] >= 0");
                    table.ForeignKey(
                        name: "FK_ProfileResidences_ApplicantProfiles_ApplicantId",
                        column: x => x.ApplicantId,
                        principalTable: "ApplicantProfiles",
                        principalColumn: "ApplicantId");
                });

            migrationBuilder.CreateTable(
                name: "Units",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UnitTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, collation: "Latin1_General_100_BIN2"),
                    Bedrooms = table.Column<int>(type: "int", nullable: false),
                    MonthlyRent = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    ArchivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Units", x => x.Id);
                    table.CheckConstraint("CK_Units_ArchivedAt_Utc", "[ArchivedAt] IS NULL OR DATEPART(TZOFFSET, [ArchivedAt]) = 0");
                    table.CheckConstraint("CK_Units_Bedrooms", "[Bedrooms] >= 0");
                    table.CheckConstraint("CK_Units_CreatedAt_Utc", "[CreatedAt] IS NULL OR DATEPART(TZOFFSET, [CreatedAt]) = 0");
                    table.CheckConstraint("CK_Units_MonthlyRent", "[MonthlyRent] > 0");
                    table.CheckConstraint("CK_Units_Number", "DATALENGTH([Number]) BETWEEN 2 AND 40 AND [Number] NOT LIKE N'%[^A-Z0-9_-]%' COLLATE Latin1_General_100_BIN2");
                    table.CheckConstraint("CK_Units_Number_Nonblank", "[Number] IS NULL OR LEN(LTRIM(RTRIM([Number]))) > 0");
                    table.CheckConstraint("CK_Units_UpdatedAt_Utc", "[UpdatedAt] IS NULL OR DATEPART(TZOFFSET, [UpdatedAt]) = 0");
                    table.CheckConstraint("CK_Units_Version", "[Version] >= 1");
                    table.ForeignKey(
                        name: "FK_Units_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Units_UnitTypes_UnitTypeId",
                        column: x => x.UnitTypeId,
                        principalTable: "UnitTypes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "RentalApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApplicantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, collation: "Latin1_General_100_BIN2"),
                    ApplicantName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ApplicantPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ContactEmail = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    ApplicantInformationSavedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ResidenceHistorySavedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    StatusChangedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L),
                    CurrentAddressDisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CurrentAddressLine2 = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CurrentAddressStreetAddress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentalApplications", x => x.Id);
                    table.CheckConstraint("CK_RentalApplications_ApplicantInformationSavedAt_Utc", "[ApplicantInformationSavedAt] IS NULL OR DATEPART(TZOFFSET, [ApplicantInformationSavedAt]) = 0");
                    table.CheckConstraint("CK_RentalApplications_ApplicantName_Nonblank", "[ApplicantName] IS NULL OR LEN(LTRIM(RTRIM([ApplicantName]))) > 0");
                    table.CheckConstraint("CK_RentalApplications_ApplicantPhone", "[ApplicantPhone] IS NULL OR (DATALENGTH([ApplicantPhone]) = 24 AND [ApplicantPhone] COLLATE Latin1_General_100_BIN2 LIKE N'[0-9][0-9][0-9]-[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]')");
                    table.CheckConstraint("CK_RentalApplications_ApplicantPhone_Nonblank", "[ApplicantPhone] IS NULL OR LEN(LTRIM(RTRIM([ApplicantPhone]))) > 0");
                    table.CheckConstraint("CK_RentalApplications_ContactEmail_Nonblank", "[ContactEmail] IS NULL OR LEN(LTRIM(RTRIM([ContactEmail]))) > 0");
                    table.CheckConstraint("CK_RentalApplications_CreatedAt_Utc", "[CreatedAt] IS NULL OR DATEPART(TZOFFSET, [CreatedAt]) = 0");
                    table.CheckConstraint("CK_RentalApplications_CurrentAddressDisplayName_Nonblank", "[CurrentAddressDisplayName] IS NULL OR LEN(LTRIM(RTRIM([CurrentAddressDisplayName]))) > 0");
                    table.CheckConstraint("CK_RentalApplications_CurrentAddressLine2_Nonblank", "[CurrentAddressLine2] IS NULL OR LEN(LTRIM(RTRIM([CurrentAddressLine2]))) > 0");
                    table.CheckConstraint("CK_RentalApplications_CurrentAddressStreetAddress_Nonblank", "[CurrentAddressStreetAddress] IS NULL OR LEN(LTRIM(RTRIM([CurrentAddressStreetAddress]))) > 0");
                    table.CheckConstraint("CK_RentalApplications_ResidenceHistorySavedAt_Utc", "[ResidenceHistorySavedAt] IS NULL OR DATEPART(TZOFFSET, [ResidenceHistorySavedAt]) = 0");
                    table.CheckConstraint("CK_RentalApplications_SavedHistory", "[Status] IN ('Draft', 'Withdrawn') OR [ResidenceHistorySavedAt] IS NOT NULL");
                    table.CheckConstraint("CK_RentalApplications_Status", "[Status] IN ('Draft', 'Submitted', 'InReview', 'Returned', 'Approved', 'Denied', 'Withdrawn')");
                    table.CheckConstraint("CK_RentalApplications_StatusChangedAt_Utc", "[StatusChangedAt] IS NULL OR DATEPART(TZOFFSET, [StatusChangedAt]) = 0");
                    table.CheckConstraint("CK_RentalApplications_UpdatedAt_Utc", "[UpdatedAt] IS NULL OR DATEPART(TZOFFSET, [UpdatedAt]) = 0");
                    table.CheckConstraint("CK_RentalApplications_Version", "[Version] >= 1");
                    table.ForeignKey(
                        name: "FK_RentalApplications_AspNetUsers_ApplicantId",
                        column: x => x.ApplicantId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RentalApplications_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "UnitLeaseGuards",
                columns: table => new
                {
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConfirmedLeaseEndExclusive = table.Column<DateOnly>(type: "date", nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitLeaseGuards", x => x.UnitId);
                    table.CheckConstraint("CK_UnitLeaseGuards_Version", "[Version] >= 1");
                    table.ForeignKey(
                        name: "FK_UnitLeaseGuards_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ApplicationResidences",
                columns: table => new
                {
                    ApplicationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    LandlordName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LandlordPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MoveInDate = table.Column<DateOnly>(type: "date", nullable: false),
                    MoveOutDate = table.Column<DateOnly>(type: "date", nullable: false),
                    AddressDisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AddressLine2 = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AddressStreetAddress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicationResidences", x => new { x.ApplicationId, x.Position });
                    table.CheckConstraint("CK_ApplicationResidences_AddressDisplayName_Nonblank", "[AddressDisplayName] IS NULL OR LEN(LTRIM(RTRIM([AddressDisplayName]))) > 0");
                    table.CheckConstraint("CK_ApplicationResidences_AddressLine2_Nonblank", "[AddressLine2] IS NULL OR LEN(LTRIM(RTRIM([AddressLine2]))) > 0");
                    table.CheckConstraint("CK_ApplicationResidences_AddressStreetAddress_Nonblank", "[AddressStreetAddress] IS NULL OR LEN(LTRIM(RTRIM([AddressStreetAddress]))) > 0");
                    table.CheckConstraint("CK_ApplicationResidences_Dates", "[MoveInDate] < [MoveOutDate]");
                    table.CheckConstraint("CK_ApplicationResidences_LandlordName_Nonblank", "[LandlordName] IS NULL OR LEN(LTRIM(RTRIM([LandlordName]))) > 0");
                    table.CheckConstraint("CK_ApplicationResidences_LandlordPhone", "[LandlordPhone] IS NULL OR (DATALENGTH([LandlordPhone]) = 24 AND [LandlordPhone] COLLATE Latin1_General_100_BIN2 LIKE N'[0-9][0-9][0-9]-[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]')");
                    table.CheckConstraint("CK_ApplicationResidences_LandlordPhone_Nonblank", "[LandlordPhone] IS NULL OR LEN(LTRIM(RTRIM([LandlordPhone]))) > 0");
                    table.CheckConstraint("CK_ApplicationResidences_Position", "[Position] >= 0");
                    table.ForeignKey(
                        name: "FK_ApplicationResidences_RentalApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "RentalApplications",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ApplicationStatusHistory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Sequence = table.Column<long>(type: "bigint", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, collation: "Latin1_General_100_BIN2"),
                    FromStatus = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: true, collation: "Latin1_General_100_BIN2"),
                    ToStatus = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, collation: "Latin1_General_100_BIN2"),
                    Comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicationStatusHistory", x => x.Id);
                    table.CheckConstraint("CK_ApplicationStatusHistory_Comment_Nonblank", "[Comment] IS NULL OR LEN(LTRIM(RTRIM([Comment]))) > 0");
                    table.CheckConstraint("CK_ApplicationStatusHistory_OccurredAt_Utc", "[OccurredAt] IS NULL OR DATEPART(TZOFFSET, [OccurredAt]) = 0");
                    table.CheckConstraint("CK_History_Comment", "[Action] NOT IN ('Return', 'Deny') OR [Comment] IS NOT NULL");
                    table.CheckConstraint("CK_History_Sequence", "[Sequence] >= 1");
                    table.CheckConstraint("CK_History_Transition", "([Action] = 'Create' AND [FromStatus] IS NULL AND [ToStatus] = 'Draft') OR\n([FromStatus] IS NOT NULL AND (\n  ([Action] = 'Submit' AND [FromStatus] IN ('Draft', 'Returned') AND [ToStatus] = 'Submitted') OR\n  ([Action] = 'StartReview' AND [FromStatus] = 'Submitted' AND [ToStatus] = 'InReview') OR\n  ([Action] = 'Release' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Submitted') OR\n  ([Action] = 'Return' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Returned') OR\n  ([Action] = 'Deny' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Denied') OR\n  ([Action] = 'Approve' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Approved') OR\n  ([Action] = 'Withdraw' AND [FromStatus] IN ('Draft', 'Returned', 'Submitted', 'InReview') AND [ToStatus] = 'Withdrawn')))");
                    table.ForeignKey(
                        name: "FK_ApplicationStatusHistory_AspNetUsers_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ApplicationStatusHistory_RentalApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "RentalApplications",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Leases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDateExclusive = table.Column<DateOnly>(type: "date", nullable: false),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leases", x => x.Id);
                    table.CheckConstraint("CK_Leases_ApprovedAt_Utc", "[ApprovedAt] IS NULL OR DATEPART(TZOFFSET, [ApprovedAt]) = 0");
                    table.CheckConstraint("CK_Leases_Dates", "[StartDate] < [EndDateExclusive]");
                    table.CheckConstraint("CK_Leases_Duration", "[EndDateExclusive] = DATEADD(month, 12, [StartDate])");
                    table.CheckConstraint("CK_Leases_StartInstant", "[StartDate] = CONVERT(date, [ApprovedAt])");
                    table.ForeignKey(
                        name: "FK_Leases_RentalApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "RentalApplications",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ManagerNotes",
                columns: table => new
                {
                    ApplicationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorManagerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Body = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ManagerNotes", x => new { x.ApplicationId, x.AuthorManagerId });
                    table.CheckConstraint("CK_ManagerNotes_CreatedAt_Utc", "[CreatedAt] IS NULL OR DATEPART(TZOFFSET, [CreatedAt]) = 0");
                    table.CheckConstraint("CK_ManagerNotes_UpdatedAt_Utc", "[UpdatedAt] IS NULL OR DATEPART(TZOFFSET, [UpdatedAt]) = 0");
                    table.CheckConstraint("CK_ManagerNotes_Version", "[Version] >= 1");
                    table.ForeignKey(
                        name: "FK_ManagerNotes_AspNetUsers_AuthorManagerId",
                        column: x => x.AuthorManagerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ManagerNotes_RentalApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "RentalApplications",
                        principalColumn: "Id");
                });

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { new Guid("019a0000-0000-7000-8000-000000000001"), "applicant-role-v1", "Applicant", "APPLICANT" },
                    { new Guid("019a0000-0000-7000-8000-000000000002"), "manager-role-v1", "PropertyManager", "PROPERTYMANAGER" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationResidences_Chronological",
                table: "ApplicationResidences",
                columns: new[] { "ApplicationId", "MoveInDate", "MoveOutDate", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_History_ActorUserId",
                table: "ApplicationStatusHistory",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "UX_History_Application_Sequence",
                table: "ApplicationStatusHistory",
                columns: new[] { "ApplicationId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true,
                filter: "[NormalizedName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "UX_AspNetUserRoles_UserId",
                table: "AspNetUserRoles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail",
                unique: true,
                filter: "[NormalizedEmail] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true,
                filter: "[NormalizedUserName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_Leases_ApplicationId",
                table: "Leases",
                column: "ApplicationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ManagerNotes_AuthorManagerId",
                table: "ManagerNotes",
                column: "AuthorManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileResidences_Chronological",
                table: "ProfileResidences",
                columns: new[] { "ApplicantId", "MoveInDate", "MoveOutDate", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_Properties_OwnerManagerId_ArchivedAt",
                table: "Properties",
                columns: new[] { "OwnerManagerId", "ArchivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Applications_Applicant_Created",
                table: "RentalApplications",
                columns: new[] { "ApplicantId", "CreatedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Applications_Applicant_StatusChanged",
                table: "RentalApplications",
                columns: new[] { "ApplicantId", "StatusChangedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Applications_Created",
                table: "RentalApplications",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_Applications_Status_Created",
                table: "RentalApplications",
                columns: new[] { "Status", "CreatedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Applications_Status_StatusChanged",
                table: "RentalApplications",
                columns: new[] { "Status", "StatusChangedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Applications_StatusChanged",
                table: "RentalApplications",
                column: "StatusChangedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_Applications_UnitId",
                table: "RentalApplications",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "UX_Applications_OpenApplicantUnit",
                table: "RentalApplications",
                columns: new[] { "ApplicantId", "UnitId" },
                unique: true,
                filter: "[Status] IN ('Draft', 'Submitted', 'InReview', 'Returned')");

            migrationBuilder.CreateIndex(
                name: "IX_Units_PropertyId_ArchivedAt",
                table: "Units",
                columns: new[] { "PropertyId", "ArchivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Units_UnitTypeId",
                table: "Units",
                column: "UnitTypeId");

            migrationBuilder.CreateIndex(
                name: "UX_Units_Property_Number",
                table: "Units",
                columns: new[] { "PropertyId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_UnitTypes_Code",
                table: "UnitTypes",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApplicationResidences");

            migrationBuilder.DropTable(
                name: "ApplicationStatusHistory");

            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "DatabaseMetadata");

            migrationBuilder.DropTable(
                name: "Leases");

            migrationBuilder.DropTable(
                name: "ManagerNotes");

            migrationBuilder.DropTable(
                name: "ProfileResidences");

            migrationBuilder.DropTable(
                name: "UnitLeaseGuards");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "RentalApplications");

            migrationBuilder.DropTable(
                name: "ApplicantProfiles");

            migrationBuilder.DropTable(
                name: "Units");

            migrationBuilder.DropTable(
                name: "Properties");

            migrationBuilder.DropTable(
                name: "UnitTypes");

            migrationBuilder.DropTable(
                name: "AspNetUsers");
        }
    }
}
