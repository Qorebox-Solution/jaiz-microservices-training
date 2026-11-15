using Confluent.Kafka;
using System.Net.Http.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpClient();
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "Transfer Service is running" }));

app.MapPost("/", async (TransferRequest request, IHttpClientFactory clients) =>
{
    if (request.Amount <= 0)
        return Results.BadRequest(new { message = "Amount must be greater than zero" });

    var accountUrl = Environment.GetEnvironmentVariable("ACCOUNT_URL") ?? "http://localhost:5101";
    var client = clients.CreateClient();
    var account = await client.GetAsync($"{accountUrl}/{request.FromAccount}");

    if (!account.IsSuccessStatusCode)
        return Results.BadRequest(new { message = "Source account was not found" });

    var kafka = Environment.GetEnvironmentVariable("KAFKA_BOOTSTRAP") ?? "localhost:9092";
    using var producer = new ProducerBuilder<Null, string>(
        new ProducerConfig { BootstrapServers = kafka }).Build();

    var transferId = Guid.NewGuid().ToString();
    var message = System.Text.Json.JsonSerializer.Serialize(new
    {
        transferId,
        request.FromAccount,
        request.ToAccount,
        request.Amount,
        status = "Accepted"
    });

    await producer.ProduceAsync("bank-transfers",
        new Message<Null, string> { Value = message });

    return Results.Accepted($"/{transferId}", new
    {
        transferId,
        status = "Transfer accepted for demonstration"
    });
});

app.Run();

record TransferRequest(string FromAccount, string ToAccount, decimal Amount);
