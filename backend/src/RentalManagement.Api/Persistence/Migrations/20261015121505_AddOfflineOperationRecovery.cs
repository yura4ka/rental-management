using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentalManagement.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOfflineOperationRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Pre-protocol writes used Guid.Empty as history trace metadata. Give only those legacy rows
            // independent trace IDs before adding uniqueness; no historical execution receipts are invented.
            migrationBuilder.Sql("""
                UPDATE [ApplicationStatusHistory] SET [OperationId] = NEWID()
                WHERE [OperationId] = '00000000-0000-0000-0000-000000000000';
                """);
            migrationBuilder.CreateTable(
                name: "LogoutAcknowledgements",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AcknowledgedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogoutAcknowledgements", x => new { x.AccountId, x.OperationId });
                    table.CheckConstraint("CK_LogoutAcknowledgements_AcknowledgedAt_Utc", "[AcknowledgedAt] IS NULL OR DATEPART(TZOFFSET, [AcknowledgedAt]) = 0");
                    table.ForeignKey(
                        name: "FK_LogoutAcknowledgements_AspNetUsers_AccountId",
                        column: x => x.AccountId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "OperationReceipts",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnvironmentGeneration = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CommandType = table.Column<string>(type: "varchar(100)", unicode: false, maxLength: 100, nullable: false),
                    TargetType = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: false),
                    TargetId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    FingerprintVersion = table.Column<int>(type: "int", nullable: false),
                    RequestFingerprint = table.Column<byte[]>(type: "binary(32)", nullable: false),
                    Outcome = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: true, collation: "Latin1_General_100_BIN2"),
                    HttpStatus = table.Column<short>(type: "smallint", nullable: true),
                    Code = table.Column<string>(type: "varchar(100)", unicode: false, maxLength: 100, nullable: true),
                    ResponseSchemaVersion = table.Column<int>(type: "int", nullable: true),
                    ResponseJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FinalizedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationReceipts", x => new { x.AccountId, x.OperationId });
                    table.CheckConstraint("CK_OperationReceipts_Code_Nonblank", "[Code] IS NULL OR LEN(LTRIM(RTRIM([Code]))) > 0");
                    table.CheckConstraint("CK_OperationReceipts_CommandType_Nonblank", "[CommandType] IS NULL OR LEN(LTRIM(RTRIM([CommandType]))) > 0");
                    table.CheckConstraint("CK_OperationReceipts_FinalizedAt_Utc", "[FinalizedAt] IS NULL OR DATEPART(TZOFFSET, [FinalizedAt]) = 0");
                    table.CheckConstraint("CK_OperationReceipts_Outcome_Nonblank", "[Outcome] IS NULL OR LEN(LTRIM(RTRIM([Outcome]))) > 0");
                    table.CheckConstraint("CK_OperationReceipts_ResponseJson_Nonblank", "[ResponseJson] IS NULL OR LEN(LTRIM(RTRIM([ResponseJson]))) > 0");
                    table.CheckConstraint("CK_OperationReceipts_TargetId_Nonblank", "[TargetId] IS NULL OR LEN(LTRIM(RTRIM([TargetId]))) > 0");
                    table.CheckConstraint("CK_OperationReceipts_TargetType_Nonblank", "[TargetType] IS NULL OR LEN(LTRIM(RTRIM([TargetType]))) > 0");
                    table.CheckConstraint("CK_Receipts_FingerprintVersion", "[FingerprintVersion] >= 1");
                    table.CheckConstraint("CK_Receipts_Json", "[ResponseJson] IS NULL OR ISJSON([ResponseJson]) = 1");
                    table.CheckConstraint("CK_Receipts_ResponseSchemaVersion", "[ResponseSchemaVersion] IS NULL OR [ResponseSchemaVersion] >= 1");
                    table.CheckConstraint("CK_Receipts_Shape", "([Outcome] IS NULL AND [HttpStatus] IS NULL AND [Code] IS NULL AND\n [ResponseSchemaVersion] IS NULL AND [ResponseJson] IS NULL AND [FinalizedAt] IS NULL) OR\n([Outcome] IS NOT NULL AND [HttpStatus] IS NOT NULL AND [ResponseSchemaVersion] IS NOT NULL AND\n [ResponseJson] IS NOT NULL AND [FinalizedAt] IS NOT NULL AND\n (([Outcome] = 'Accepted' AND [HttpStatus] BETWEEN 200 AND 299) OR\n  ([Outcome] = 'Rejected' AND [HttpStatus] IN (409, 422) AND [Code] IS NOT NULL)))");
                    table.ForeignKey(
                        name: "FK_OperationReceipts_AspNetUsers_AccountId",
                        column: x => x.AccountId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "UX_History_Application_Operation",
                table: "ApplicationStatusHistory",
                columns: new[] { "ApplicationId", "OperationId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LogoutAcknowledgements");

            migrationBuilder.DropTable(
                name: "OperationReceipts");

            migrationBuilder.DropIndex(
                name: "UX_History_Application_Operation",
                table: "ApplicationStatusHistory");
        }
    }
}
