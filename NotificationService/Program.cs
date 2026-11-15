using Confluent.Kafka;

var config = new ConsumerConfig
{
    BootstrapServers = Environment.GetEnvironmentVariable("KAFKA_BOOTSTRAP") ?? "localhost:9092",
    GroupId = "jaiz-notifications",
    AutoOffsetReset = AutoOffsetReset.Earliest
};

while (true)
{
    try
    {
        using var consumer = new ConsumerBuilder<Ignore, string>(config).Build();
        consumer.Subscribe("bank-transfers");
        Console.WriteLine("Notification Service is waiting for transfer events...");

        while (true)
        {
            var result = consumer.Consume();
            Console.WriteLine($"NOTIFICATION: Transfer event received: {result.Message.Value}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Kafka connection issue: {ex.Message}. Retrying in 5 seconds...");
        await Task.Delay(TimeSpan.FromSeconds(5));
    }
}
