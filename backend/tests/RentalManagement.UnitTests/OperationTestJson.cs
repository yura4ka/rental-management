using System.Text.Json.Nodes;

namespace RentalManagement.UnitTests;

internal static class OperationTestJson
{
    internal static string WithMetadata(string json)
    {
        var node = JsonNode.Parse(json)!;
        node["operationId"] = Guid.CreateVersion7();
        node["environmentGeneration"] = Guid.NewGuid();
        return node.ToJsonString();
    }
}
