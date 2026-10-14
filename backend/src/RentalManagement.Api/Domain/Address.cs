using System.ComponentModel.DataAnnotations.Schema;

namespace RentalManagement.Api.Domain;

[ComplexType]
public sealed class Address
{
    public string? DisplayName { get; set; }
    public string? StreetAddress { get; set; }
    public string? Line2 { get; set; }
}
