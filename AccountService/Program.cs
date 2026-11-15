var accounts = new Dictionary<string, object>
{
    ["100001"] = new { accountNumber = "100001", name = "Amina Yusuf", balance = 250000 },
    ["100002"] = new { accountNumber = "100002", name = "Musa Bello", balance = 180000 }
};

var app = WebApplication.CreateBuilder(args).Build();

app.MapGet("/health", () => Results.Ok(new { status = "Account Service is running" }));

app.MapGet("/{accountNumber}", (string accountNumber) =>
    accounts.TryGetValue(accountNumber, out var account)
        ? Results.Ok(account)
        : Results.NotFound(new { message = "Account not found" }));

app.Run();
