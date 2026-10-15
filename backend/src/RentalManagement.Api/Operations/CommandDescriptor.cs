using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using RentalManagement.Api.Contracts.Applications;
using RentalManagement.Api.Contracts.Inventory;
using RentalManagement.Api.Contracts.Operations;
using RentalManagement.Api.Controllers;
using RentalManagement.Api.Infrastructure;

namespace RentalManagement.Api.Operations;

public sealed record AuthorizationScope(string Type, Guid Id, string Access);
public sealed record CommandDescriptor(string CommandType, string TargetType, string TargetId,
    AuthorizationScope AuthorizationScope, IReadOnlyDictionary<string, string> Route)
{
    public static CommandDescriptor From(ActionExecutingContext context, OperationRequest request)
    {
        var action = (ControllerActionDescriptor)context.ActionDescriptor;
        var account = Guid.Parse(context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        Guid Argument(string name) => context.ActionArguments.TryGetValue(name, out var value) && value is Guid id
            ? id : throw new InvalidOperationException("Missing command route ID.");
        var controller = action.ControllerTypeInfo.AsType();
        var target = "";
        Guid targetId;
        AuthorizationScope scope;
        if (controller == typeof(PropertiesController))
        {
            target = "Property";
            targetId = request is CreatePropertyRequest create ? CreateId(create.Id) : Argument("id");
            scope = request is CreatePropertyRequest ? new("Account", account, "Manager") : new("Property", targetId, "Owner");
        }
        else if (controller == typeof(UnitsController))
        {
            target = "Unit";
            targetId = request is CreateUnitRequest create ? CreateId(create.Id) : Argument("id");
            scope = new("Property", Argument("propertyId"), "Owner");
        }
        else if (controller == typeof(ApplicantProfileController))
        {
            target = "Profile";
            targetId = account;
            scope = new("Account", account, "Applicant");
        }
        else if (controller == typeof(UnitApplicationsController))
        {
            target = "Unit";
            targetId = Argument("unitId");
            scope = new("Unit", targetId, "Owner");
        }
        else if (controller == typeof(ApplicationsController) && request is CreateApplicationRequest create)
        {
            target = "Application";
            targetId = CreateId(create.Id);
            scope = new("Unit", create.UnitId, "Applicant");
        }
        else if (controller == typeof(ApplicationsController) || controller == typeof(ApplicationReviewsController))
        {
            target = request is SaveManagerNoteRequest ? "ManagerNote" : "Application";
            targetId = Argument("id");
            scope = new("Application", targetId, controller == typeof(ApplicationsController) ? "Applicant" :
                request is SaveManagerNoteRequest ? "Manager" : "Owner");
        }
        else throw new InvalidOperationException("Unregistered business command.");

        var route = context.ActionArguments.Where(p => p.Value is Guid)
            .ToDictionary(p => p.Key, p => ((Guid)p.Value!).ToString("D"), StringComparer.Ordinal);
        return new(action.ControllerName + "." + action.ActionName, target, targetId.ToString("D"), scope, route);
    }

    private static Guid CreateId(Guid id)
    {
        CommandRunner.RequireUuid7(id, "id");
        return id;
    }
}
