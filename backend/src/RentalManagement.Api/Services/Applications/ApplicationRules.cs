using RentalManagement.Api.Domain;
using RentalManagement.Api.Infrastructure;

namespace RentalManagement.Api.Services.Applications;

internal static class ApplicationRules
{
    internal static bool IsOpen(ApplicationStatus status) => status is ApplicationStatus.Draft or
        ApplicationStatus.Submitted or ApplicationStatus.InReview or ApplicationStatus.Returned;

    internal static ApplicationStatus Transition(ApplicationStatus status, ApplicationAction action) => (status, action) switch
    {
        (ApplicationStatus.Draft or ApplicationStatus.Returned, ApplicationAction.Submit) => ApplicationStatus.Submitted,
        (ApplicationStatus.Submitted, ApplicationAction.StartReview) => ApplicationStatus.InReview,
        (ApplicationStatus.InReview, ApplicationAction.Release) => ApplicationStatus.Submitted,
        (ApplicationStatus.InReview, ApplicationAction.Return) => ApplicationStatus.Returned,
        (ApplicationStatus.InReview, ApplicationAction.Deny) => ApplicationStatus.Denied,
        (ApplicationStatus.InReview, ApplicationAction.Approve) => ApplicationStatus.Approved,
        (_, ApplicationAction.Withdraw) when IsOpen(status) => ApplicationStatus.Withdrawn,
        _ => throw new ApiException(409, "IllegalApplicationTransition", "This action is not available in the current status.")
    };
}
