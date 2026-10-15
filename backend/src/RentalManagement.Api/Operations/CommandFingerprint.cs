using System.Security.Cryptography;
using System.Text.Json;
using RentalManagement.Api.Infrastructure;

namespace RentalManagement.Api.Operations;

public static class CommandFingerprint
{
    public const int Version = 1;

    public static byte[] Compute(string commandType, string targetType, string targetId,
        IReadOnlyDictionary<string, string> route, JsonElement request)
    {
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("commandType", commandType);
            writer.WriteString("targetType", targetType);
            writer.WriteString("targetId", targetId);
            writer.WritePropertyName("route");
            writer.WriteStartObject();
            foreach (var pair in route.OrderBy(p => p.Key, StringComparer.Ordinal))
                writer.WriteString(pair.Key, pair.Value);
            writer.WriteEndObject();
            writer.WritePropertyName("request");
            WriteCanonical(writer, request);
            writer.WriteEndObject();
        }
        return SHA256.HashData(buffer.ToArray());
    }

    private static void WriteCanonical(Utf8JsonWriter writer, JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                var properties = value.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal).ToArray();
                if (properties.Select(p => p.Name).Distinct(StringComparer.Ordinal).Count() != properties.Length)
                    throw new ApiException(400, "MalformedRequest", "Duplicate JSON properties are not allowed.");
                foreach (var property in properties)
                {
                    writer.WritePropertyName(property.Name);
                    WriteCanonical(writer, property.Value);
                }
                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in value.EnumerateArray()) WriteCanonical(writer, item);
                writer.WriteEndArray();
                break;
            default:
                value.WriteTo(writer);
                break;
        }
    }
}
