using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentalManagement.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AllowBulkApplicationDenial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_RentalApplications_SavedHistory",
                table: "RentalApplications");

            migrationBuilder.DropCheckConstraint(
                name: "CK_History_Transition",
                table: "ApplicationStatusHistory");

            migrationBuilder.AddCheckConstraint(
                name: "CK_RentalApplications_SavedHistory",
                table: "RentalApplications",
                sql: "[Status] IN ('Draft', 'Withdrawn', 'Denied') OR [ResidenceHistorySavedAt] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_History_Transition",
                table: "ApplicationStatusHistory",
                sql: "([Action] = 'Create' AND [FromStatus] IS NULL AND [ToStatus] = 'Draft') OR\n([FromStatus] IS NOT NULL AND (\n  ([Action] = 'Submit' AND [FromStatus] IN ('Draft', 'Returned') AND [ToStatus] = 'Submitted') OR\n  ([Action] = 'StartReview' AND [FromStatus] = 'Submitted' AND [ToStatus] = 'InReview') OR\n  ([Action] = 'Release' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Submitted') OR\n  ([Action] = 'Return' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Returned') OR\n  ([Action] = 'Deny' AND [FromStatus] IN ('Draft', 'Submitted', 'InReview', 'Returned') AND [ToStatus] = 'Denied') OR\n  ([Action] = 'Approve' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Approved') OR\n  ([Action] = 'Withdraw' AND [FromStatus] IN ('Draft', 'Returned', 'Submitted', 'InReview') AND [ToStatus] = 'Withdrawn')))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_RentalApplications_SavedHistory",
                table: "RentalApplications");

            migrationBuilder.DropCheckConstraint(
                name: "CK_History_Transition",
                table: "ApplicationStatusHistory");

            migrationBuilder.AddCheckConstraint(
                name: "CK_RentalApplications_SavedHistory",
                table: "RentalApplications",
                sql: "[Status] IN ('Draft', 'Withdrawn') OR [ResidenceHistorySavedAt] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_History_Transition",
                table: "ApplicationStatusHistory",
                sql: "([Action] = 'Create' AND [FromStatus] IS NULL AND [ToStatus] = 'Draft') OR\n([FromStatus] IS NOT NULL AND (\n  ([Action] = 'Submit' AND [FromStatus] IN ('Draft', 'Returned') AND [ToStatus] = 'Submitted') OR\n  ([Action] = 'StartReview' AND [FromStatus] = 'Submitted' AND [ToStatus] = 'InReview') OR\n  ([Action] = 'Release' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Submitted') OR\n  ([Action] = 'Return' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Returned') OR\n  ([Action] = 'Deny' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Denied') OR\n  ([Action] = 'Approve' AND [FromStatus] = 'InReview' AND [ToStatus] = 'Approved') OR\n  ([Action] = 'Withdraw' AND [FromStatus] IN ('Draft', 'Returned', 'Submitted', 'InReview') AND [ToStatus] = 'Withdrawn')))");
        }
    }
}
