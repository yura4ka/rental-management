using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace RentalManagement.Api.Infrastructure;

// Only resource versions are decimal strings. Native Identity expiresIn must remain numeric.
public sealed class VersionJsonConverter : JsonConverter<long>
{
    public static void Configure(JsonTypeInfo typeInfo)
    {
        foreach (var property in typeInfo.Properties)
        {
            if (!property.Name.Equals("version", StringComparison.OrdinalIgnoreCase) &&
                !property.Name.Equals("expectedVersion", StringComparison.OrdinalIgnoreCase)) continue;
            if (property.PropertyType == typeof(long)) property.CustomConverter = new VersionJsonConverter();
            else if (property.PropertyType == typeof(long?)) property.CustomConverter = new NullableVersionJsonConverter();
        }
    }

    public override long Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String ||
            !long.TryParse(reader.GetString(), NumberStyles.None, CultureInfo.InvariantCulture, out var value) || value < 1)
            throw new JsonException("Expected a positive bigint encoded as a decimal string.");
        return value;
    }

    public override void Write(Utf8JsonWriter writer, long value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString(CultureInfo.InvariantCulture));
}

public sealed class NullableVersionJsonConverter : JsonConverter<long?>
{
    private readonly VersionJsonConverter inner = new();

    public override long? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.Null ? null : inner.Read(ref reader, typeof(long), options);

    public override void Write(Utf8JsonWriter writer, long? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else inner.Write(writer, value.Value, options);
    }
}
