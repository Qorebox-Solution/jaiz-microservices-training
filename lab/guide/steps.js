/* Jaiz Bank — Zero-Assumption Practical Trainer Guide, as interactive steps.
 * Block types: p, h, file, list, explain, code, diagram, table, trainer, expected, warn, lab
 * Code text matches the reference solution in the repository root.
 */

const CODE = {
  accountCsproj: `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>`,

  accountProgram: `var accounts = new Dictionary<string, object>
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

app.Run();`,

  transferCsproj: `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Confluent.Kafka" Version="2.8.0" />
  </ItemGroup>
</Project>`,

  transferProgram: `using Confluent.Kafka;
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

record TransferRequest(string FromAccount, string ToAccount, decimal Amount);`,

  notificationRef: `<ItemGroup>
  <PackageReference Include="Confluent.Kafka" Version="2.8.0" />
</ItemGroup>`,

  notificationProgram: `using Confluent.Kafka;

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
}`,

  dockerfile: (name, runtime) => `FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ${name}.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/${runtime}:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "${name}.dll"]`,

  kafkaService: `kafka:
  image: apache/kafka:4.0.0
  hostname: kafka
  container_name: jaiz-kafka
  ports:
    - "9092:9092"
  environment:
    KAFKA_NODE_ID: 1
    KAFKA_PROCESS_ROLES: broker,controller
    KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
    KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"`,

  kong: `_format_version: "3.0"
_transform: true

services:
  - name: account-service
    url: http://account-service:8080
    routes:
      - name: account-route
        paths:
          - /accounts
        strip_path: true

  - name: transfer-service
    url: http://transfer-service:8080
    routes:
      - name: transfer-route
        paths:
          - /transfers
        strip_path: true`,

  compose: `services:
  account-service:
    build: ./AccountService
    environment:
      ASPNETCORE_URLS: http://+:8080
    ports:
      - "5101:8080"

  transfer-service:
    build: ./TransferService
    environment:
      ASPNETCORE_URLS: http://+:8080
      ACCOUNT_URL: http://account-service:8080
      KAFKA_BOOTSTRAP: kafka:9092
    depends_on:
      - account-service
      - kafka
    ports:
      - "5102:8080"

  notification-service:
    build: ./NotificationService
    environment:
      KAFKA_BOOTSTRAP: kafka:9092
    depends_on:
      - kafka

  kafka:
    image: apache/kafka:4.0.0
    hostname: kafka
    container_name: jaiz-kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"

  kong:
    image: kong:3.9
    depends_on:
      - account-service
      - transfer-service
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /kong/kong.yml
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
    volumes:
      - ./kong.yml:/kong/kong.yml:ro
    ports:
      - "8000:8000"
      - "127.0.0.1:8001:8001"`,

  transferCurl: `curl -i -X POST http://localhost:8000/transfers/ \\
  -H "Content-Type: application/json" \\
  -d '{"fromAccount":"100001","toAccount":"100002","amount":5000}'`,
};

const P1 = 'Part 1 — What we are building';
const P2 = 'Part 2 — Prepare the computer';
const P3 = 'Part 3 — Account Service';
const P4 = 'Part 4 — Transfer Service + Kafka library';
const P5 = 'Part 5 — Notification Service';
const P6 = 'Part 6 — Dockerfiles';
const P7 = 'Part 7 — Kafka in Docker Compose';
const P8 = 'Part 8 — Kong Gateway';
const P9 = 'Part 9 — Docker Compose';
const P10 = 'Part 10 — Start and check';
const P11 = 'Part 11 — Demonstrations';
const P12 = 'Part 12 — Explain the flow back';
const P13 = 'Part 13 — Troubleshooting';
const P14 = 'Part 14 — Limits & closing';

window.LAB_STEPS = [
  // ───────────────────────── START ─────────────────────────
  {
    part: 'Start here', title: 'How to use this lab',
    body: [
      { t: 'p', html: 'The guide is on the <strong>left</strong> and a real <strong>VS Code</strong> is on the <strong>right</strong>. You can do the whole session in this one browser tab.' },
      { t: 'list', items: [
        '<strong>Next ▶</strong> or the <code>→</code> key moves forward. <code>←</code> goes back. <code>G</code> hides or shows the guide.',
        'Every command or file has a <strong>Copy</strong> button. Paste it into the VS Code terminal or editor on the right.',
        'Open a terminal in VS Code with <strong>☰ menu → Terminal → New Terminal</strong> (or <code>Ctrl+`</code>).',
        'Drag the divider to resize. <strong>A− / A+</strong> changes the text size for the projector.',
        'Your position is remembered, so you can refresh the page any time.',
      ]},
      { t: 'lab', title: 'About this VS Code', html: 'It runs in a container that already has the .NET 10 SDK and the Docker CLI. Docker commands you run here use the Docker Desktop on this laptop. VS Code shows the folder the lab was started on: by default the <code>jaiz-microservices-lab</code> repo folder, so edits here are your real files. Start with <code>./start.sh workspace</code> for an empty folder.' },
      { t: 'warn', title: 'Training safety', html: 'This is a fake-data learning simulation. It does not move money or connect to bank systems. Never use real customer data or credentials.' },
      { t: 'trainer', title: 'Teaching rule', html: 'Do not skip a step because it seems obvious. Participants are not expected to know .NET project files, NuGet, Dockerfiles, Compose networking, Kong declarative configuration, Kafka topics, producers or consumers. Explain each one before asking them to use it.' },
    ]
  },

  // ───────────────────────── PART 1 ─────────────────────────
  {
    part: P1, title: '1.1 The final result',
    body: [
      { t: 'p', html: 'We will build three small applications:' },
      { t: 'list', ordered: true, items: [
        '<strong>Account Service:</strong> returns details for two sample accounts.',
        '<strong>Transfer Service:</strong> accepts a transfer request, asks Account Service whether the source account exists, then publishes a message to Kafka.',
        '<strong>Notification Service:</strong> listens for messages from Kafka and prints each transfer event.',
      ]},
      { t: 'p', html: 'We will also run:' },
      { t: 'list', items: [
        '<strong>Docker:</strong> packages each application into a container.',
        '<strong>Docker Compose:</strong> starts all containers and connects them on one private network.',
        '<strong>Kong Gateway:</strong> provides one public entry point and routes requests to the correct service.',
        '<strong>Apache Kafka:</strong> carries an event from Transfer Service to Notification Service.',
      ]},
    ]
  },
  {
    part: P1, title: '1.2 Draw the architecture before opening the code',
    body: [
      { t: 'diagram', text:
`        API CLIENT (curl / Postman)
                  |
                  | HTTP :8000
                  v
             KONG GATEWAY
            /            \\
      /accounts        /transfers
          |                 |
          v                 v
   ACCOUNT SERVICE <---- TRANSFER SERVICE
                            |
                            | publishes event
                            v
                       APACHE KAFKA
                   topic: bank-transfers
                            |
                            | consumer reads
                            v
                  NOTIFICATION SERVICE
                     prints the event` },
      { t: 'h', html: 'Two communication patterns' },
      { t: 'list', items: [
        '<strong>Request/response (HTTP):</strong> Transfer Service calls Account Service and waits for an answer. It needs to know whether the source account exists before it continues.',
        '<strong>Event messaging (Kafka):</strong> Transfer Service publishes a message. It does not call Notification Service directly or wait for Notification Service to finish. Kafka holds the event for a consumer to read.',
      ]},
      { t: 'trainer', html: 'Ask the room: <em>“If the notification application is temporarily stopped, should the transfer API need to call it directly?”</em> Lead them to the idea that asynchronous messaging separates the producer from the consumer.' },
    ]
  },
  {
    part: P1, title: '1.3 Words participants must understand',
    body: [
      { t: 'table', head: ['Word', 'Plain-language meaning'], rows: [
        ['Application / service', 'A small program responsible for one job.'],
        ['API', 'A defined way for one program to request something from another.'],
        ['Endpoint', 'A particular API address, such as <code>GET /100001</code>.'],
        ['HTTP', 'A request-and-response communication protocol commonly used by APIs.'],
        ['JSON', 'A text format used to represent data, for example an account number and amount.'],
        ['SDK', 'Software tools used to build applications for a platform. The .NET SDK includes the compiler and command-line tools.'],
        ['NuGet', 'The .NET package manager. It downloads reusable libraries that our code depends on.'],
        ['Package', 'Reusable code supplied by another developer or organisation.'],
        ['<code>.csproj</code>', 'The .NET project file. It describes the project, its target .NET version and package dependencies.'],
        ['Docker image', 'A packaged template containing an application and what it needs to run.'],
        ['Container', 'A running instance of an image.'],
        ['Dockerfile', 'Instructions Docker follows to build an image.'],
        ['Docker Compose', 'A tool and YAML file for defining and starting multiple related containers.'],
        ['Port', 'A numbered network entry point used by a process.'],
        ['Volume mount', 'A way to make a file or folder on the host available inside a container.'],
        ['Gateway', 'An entry point that receives requests and forwards them to backend services.'],
        ['Kafka broker', 'The Kafka server that receives, stores and delivers messages.'],
        ['Topic', 'A named stream/category in Kafka where messages are written.'],
        ['Producer', 'An application that sends messages to Kafka.'],
        ['Consumer', 'An application that reads messages from Kafka.'],
        ['Consumer group', 'A named group of consumers that share the work of reading a topic.'],
        ['Bootstrap server', 'The initial Kafka address a client uses to connect to the cluster.'],
      ]},
    ]
  },

  // ───────────────────────── PART 2 ─────────────────────────
  {
    part: P2, title: '2.1 Install and check the required tools',
    body: [
      { t: 'p', html: 'Before the workshop, participants install: <strong>Docker Desktop</strong> (or Docker Engine + Compose plugin on Linux), <strong>Visual Studio Code</strong>, the <strong>.NET 10 SDK</strong>, and optionally <strong>Postman</strong>. We will also use <code>curl</code>, a command-line HTTP client.' },
      { t: 'list', items: [
        'VS Code is where we edit files.',
        'The .NET SDK creates and compiles our applications.',
        'Docker builds and runs the applications in containers.',
        'Compose starts the whole lab.',
        'Postman or curl sends test API requests.',
      ]},
      { t: 'p', html: 'Open a terminal (<strong>Terminal → New Terminal</strong>) and run these one at a time:' },
      { t: 'code', label: 'Terminal', text: `docker --version
docker compose version
dotnet --version` },
      { t: 'explain', items: [
        '<code>docker</code>: run the Docker command-line program.',
        '<code>--version</code>: print the installed version.',
        '<code>docker compose version</code>: check the Compose component.',
        '<code>dotnet --version</code>: print the installed .NET SDK version.',
      ]},
      { t: 'expected', html: 'Docker and Compose print version numbers. .NET prints a <code>10.x</code> version.' },
      { t: 'trainer', title: 'If it fails', html: 'If <code>docker</code> is not recognised, Docker is not installed or not on the PATH. Start Docker Desktop and reopen the terminal. If <code>dotnet</code> is not recognised, install the .NET 10 SDK and reopen the terminal.' },
    ]
  },
  {
    part: P2, title: '2.2 Create the working folder',
    body: [
      { t: 'code', label: 'Terminal', text: `mkdir jaiz-microservices-lab
cd jaiz-microservices-lab
code .` },
      { t: 'explain', items: [
        '<code>mkdir</code> creates a folder.',
        '<code>cd</code> moves the terminal into that folder.',
        '<code>code .</code> opens the current folder in VS Code. If this command is unavailable, open VS Code manually and use <strong>File → Open Folder</strong>.',
      ]},
      { t: 'p', html: 'We will create the files in this folder. The <code>docker-compose.yml</code> file will live at the top level.' },
      { t: 'lab', html: 'In this lab, <code>code .</code> reloads this browser VS Code with the new folder open. Open a new terminal afterwards (<strong>Terminal → New Terminal</strong>). It will start inside <code>jaiz-microservices-lab</code>.' },
    ]
  },
  {
    part: P2, title: '2.3 Create the folders',
    body: [
      { t: 'p', html: 'In the VS Code <strong>Explorer</strong>:' },
      { t: 'list', ordered: true, items: [
        'Click the <strong>New Folder</strong> icon.',
        'Create <code>AccountService</code>.',
        'Create <code>TransferService</code>.',
        'Create <code>NotificationService</code>.',
      ]},
      { t: 'p', html: 'At the root, create two empty files: <code>docker-compose.yml</code> and <code>kong.yml</code>.' },
      { t: 'diagram', text:
`jaiz-microservices-lab/
├── AccountService/
├── TransferService/
├── NotificationService/
├── docker-compose.yml
└── kong.yml` },
      { t: 'trainer', html: 'Do not create all files by guessing. We will create each project and file in the following sections.' },
    ]
  },

  // ───────────────────────── PART 3 ─────────────────────────
  {
    part: P3, title: '3.1 Create the .NET project',
    body: [
      { t: 'p', html: 'Make sure the terminal is in <code>jaiz-microservices-lab</code>, then run:' },
      { t: 'code', label: 'Terminal', text: 'dotnet new web -n AccountService' },
      { t: 'explain', items: [
        '<code>dotnet</code> invokes the .NET SDK.',
        '<code>new</code> means create a new project.',
        '<code>web</code> selects the ASP.NET Core minimal web application template.',
        '<code>-n</code> means name the project.',
        '<code>AccountService</code> is the project name.',
      ]},
      { t: 'p', html: 'The command creates a <code>.csproj</code> project file and a starter <code>Program.cs</code> file in <code>AccountService</code>.' },
      { t: 'p', html: 'A <strong>Minimal API</strong> lets us define HTTP endpoints directly in a small <code>Program.cs</code> file. We use it because the training application is intentionally small.' },
    ]
  },
  {
    part: P3, title: '3.1 Replace the project file',
    body: [
      { t: 'file', path: 'AccountService/AccountService.csproj' },
      { t: 'p', html: 'Open the file and replace its contents with:' },
      { t: 'code', label: 'Replace AccountService/AccountService.csproj', text: CODE.accountCsproj },
      { t: 'explain', items: [
        'The first line tells .NET this is a web application project.',
        '<code>TargetFramework</code> says which .NET version the application targets.',
        '<code>Nullable</code> enables compiler checks that help identify possible null-value mistakes.',
        '<code>ImplicitUsings</code> automatically imports common .NET namespaces so we do not have to write every <code>using</code> statement.',
      ]},
      { t: 'p', html: 'No extra packages are required for this Account Service. ASP.NET Core is supplied by the .NET web project template.' },
    ]
  },
  {
    part: P3, title: '3.2 Write the Account Service code',
    body: [
      { t: 'file', path: 'AccountService/Program.cs' },
      { t: 'p', html: 'Select all existing text (<code>Ctrl/Cmd+A</code>) and replace it with:' },
      { t: 'code', label: 'Replace AccountService/Program.cs', text: CODE.accountProgram },
      { t: 'h', html: 'Explain the code in order' },
      { t: 'list', ordered: true, items: [
        '<code>Dictionary</code> creates a simple in-memory collection. It stores a key (the account number) and a value (the account data).',
        'The two entries are fake training accounts. <code>100001</code> belongs to Amina; <code>100002</code> belongs to Musa.',
        '<code>WebApplication.CreateBuilder(args)</code> prepares the ASP.NET Core application and reads its configuration.',
        '<code>.Build()</code> creates the web application.',
        '<code>MapGet("/health", ...)</code> creates a GET endpoint used to check that the service is alive.',
        '<code>Results.Ok(...)</code> sends HTTP 200 and a JSON response.',
        '<code>MapGet("/{accountNumber}", ...)</code> creates an endpoint where the last part of the URL is treated as the account number.',
        '<code>TryGetValue</code> searches for the account in the dictionary.',
        'If found, return HTTP 200 with the account. If missing, return HTTP 404 (not found).',
        '<code>app.Run()</code> starts the web server and keeps the application listening for requests.',
      ]},
      { t: 'warn', html: 'The dictionary is in memory. Restarting the application resets the sample data to the values in the code. This is <strong>not a database</strong>.' },
    ]
  },
  {
    part: P3, title: '3.3 Run and test Account Service without Docker',
    body: [
      { t: 'p', html: 'From the project root:' },
      { t: 'code', label: 'Terminal 1', text: 'dotnet run --project AccountService --urls http://localhost:5101' },
      { t: 'explain', items: [
        '<code>dotnet run</code> compiles (if necessary) and starts the project.',
        '<code>--project AccountService</code> identifies which project to run.',
        '<code>--urls http://localhost:5101</code> tells its web server to listen on port 5101.',
      ]},
      { t: 'p', html: 'Open a <strong>second terminal</strong> (click <strong>+</strong> in the terminal panel) and run:' },
      { t: 'code', label: 'Terminal 2', text: `curl http://localhost:5101/health
curl http://localhost:5101/100001
curl http://localhost:5101/999999` },
      { t: 'expected', html: '<code>/health</code> returns a running message. <code>/100001</code> returns Amina’s sample account. <code>/999999</code> returns 404 <em>Account not found</em>.' },
      { t: 'p', html: 'Stop the service with <code>Ctrl+C</code> in Terminal 1.' },
      { t: 'trainer', html: 'Ask: <em>“What did the first request prove? What did the last request prove?”</em>' },
    ]
  },

  // ───────────────────────── PART 4 ─────────────────────────
  {
    part: P4, title: '4.1 Create the Transfer Service project',
    body: [
      { t: 'p', html: 'At the project root, run:' },
      { t: 'code', label: 'Terminal', text: 'dotnet new web -n TransferService' },
      { t: 'p', html: 'This creates the Transfer Service project with its <code>.csproj</code> and <code>Program.cs</code>.' },
    ]
  },
  {
    part: P4, title: '4.2 Explain NuGet, then install Confluent.Kafka',
    body: [
      { t: 'p', html: 'The Transfer Service needs to communicate with Kafka. .NET does not include the Kafka client library in the basic web template.' },
      { t: 'p', html: '<strong>NuGet</strong> is the package manager used by .NET. A NuGet package is a reusable library. We will use the <code>Confluent.Kafka</code> package, which provides .NET classes for connecting to Kafka, producing messages and consuming messages.' },
      { t: 'code', label: 'Terminal', text: 'dotnet add TransferService package Confluent.Kafka --version 2.8.0' },
      { t: 'explain', items: [
        '<code>dotnet add</code>: asks the .NET SDK to add something to a project.',
        '<code>TransferService</code>: identifies the project folder.',
        '<code>package</code>: says the thing being added is a NuGet package.',
        '<code>Confluent.Kafka</code>: the name of the Kafka client library.',
        '<code>--version 2.8.0</code>: selects the package version used in this lab.',
      ]},
      { t: 'h', html: 'What happens' },
      { t: 'list', ordered: true, items: [
        'The .NET SDK finds <code>TransferService/TransferService.csproj</code>.',
        'It adds a <code>PackageReference</code> entry to that project file.',
        'It downloads the package and its dependencies from the configured NuGet source during restore.',
      ]},
    ]
  },
  {
    part: P4, title: '4.2 See what the command changed, then restore',
    body: [
      { t: 'file', path: 'TransferService/TransferService.csproj' },
      { t: 'p', html: 'Open the file. It should look similar to:' },
      { t: 'code', label: 'TransferService/TransferService.csproj (look, do not retype)', text: CODE.transferCsproj },
      { t: 'explain', items: [
        '<code>ItemGroup</code> groups project items such as dependencies.',
        '<code>PackageReference</code> tells .NET that this project depends on the Kafka client library.',
        '<code>Include</code> is the package name.',
        '<code>Version</code> is the selected package version.',
      ]},
      { t: 'trainer', html: 'Do not ask participants to type this XML. The <code>dotnet add</code> command created it. Show it so they recognise what the command changed.' },
      { t: 'code', label: 'Terminal', text: 'dotnet restore TransferService' },
      { t: 'p', html: '<strong>restore</strong> reads the <code>.csproj</code>, finds the listed packages, and downloads anything not already available locally. If restore succeeds, the project can compile with the Kafka client library.' },
    ]
  },
  {
    part: P4, title: '4.3 Write the Transfer Service code',
    body: [
      { t: 'file', path: 'TransferService/Program.cs' },
      { t: 'p', html: 'Replace its contents with:' },
      { t: 'code', label: 'Replace TransferService/Program.cs', text: CODE.transferProgram },
      { t: 'p', html: 'Next step: walk through it carefully, section by section.' },
    ]
  },
  {
    part: P4, title: '4.4 Explain the Transfer Service code carefully',
    body: [
      { t: 'h', html: 'The using statements' },
      { t: 'list', items: [
        '<code>using Confluent.Kafka;</code> makes Kafka client types available. It works because we installed the NuGet package and restored the project.',
        '<code>using System.Net.Http.Json;</code> imports HTTP/JSON helpers. It is not essential here and may be removed if the editor reports it as unused.',
      ]},
      { t: 'h', html: 'Application setup' },
      { t: 'list', items: [
        '<code>CreateBuilder(args)</code> prepares the web app.',
        '<code>AddHttpClient()</code> registers the .NET HTTP client factory with dependency injection, giving the endpoint a managed way to create an HTTP client.',
        '<code>Build()</code> creates the application. <code>MapGet("/health")</code> is the liveness check.',
      ]},
      { t: 'h', html: 'The transfer endpoint' },
      { t: 'list', items: [
        '<code>MapPost("/")</code> accepts an HTTP POST at the root path of this service.',
        '<code>async</code> lets the method wait for network operations without blocking the server thread.',
        '<code>TransferRequest request</code> tells ASP.NET Core to read the JSON body into a C# object.',
        '<code>IHttpClientFactory clients</code> provides the registered HTTP client factory.',
        '<code>request.Amount &lt;= 0</code> → <code>Results.BadRequest(...)</code> returns HTTP 400 for zero or negative amounts.',
      ]},
      { t: 'h', html: 'Read the Account Service address' },
      { t: 'list', items: [
        '<code>Environment.GetEnvironmentVariable("ACCOUNT_URL")</code> reads an environment variable: a setting supplied outside the code, often by Docker Compose.',
        '<code>?? "http://localhost:5101"</code> is the fallback if the variable is missing.',
        'Inside Docker, Compose sets it to <code>http://account-service:8080</code>. <strong><code>localhost</code> inside a container means that same container</strong>, not another container.',
      ]},
      { t: 'h', html: 'Call Account Service' },
      { t: 'list', items: [
        '<code>clients.CreateClient()</code> creates an HTTP client; <code>GetAsync(...)</code> sends a GET including the source account number; <code>await</code> waits for the response.',
        '<code>IsSuccessStatusCode</code> checks for an HTTP success code. If the lookup fails, return a bad request.',
      ]},
      { t: 'h', html: 'Kafka address and producer' },
      { t: 'list', items: [
        '<code>KAFKA_BOOTSTRAP</code>: Compose supplies <code>kafka:9092</code>. The <code>localhost:9092</code> fallback is only for a host-run process with a compatible listener, so run the services inside Compose for the workshop.',
        '<code>ProducerConfig</code> is the producer configuration; <code>BootstrapServers</code> says where to find the broker.',
        '<code>ProducerBuilder&lt;Null, string&gt;</code>: message key unused (<code>Null</code>), value is a string. <code>.Build()</code> creates it.',
        '<code>using var</code> disposes the producer when the endpoint finishes.',
      ]},
      { t: 'h', html: 'Create and publish the event' },
      { t: 'list', items: [
        '<code>Guid.NewGuid()</code> generates a unique ID; <code>JsonSerializer.Serialize(...)</code> converts the object to JSON text (ID, from, to, amount, status).',
        '<code>ProduceAsync("bank-transfers", ...)</code> sends the message to the topic <code>bank-transfers</code>, a labelled channel where related events are stored.',
        'No message key is set in this basic example. <code>await</code> waits for Kafka to acknowledge.',
      ]},
      { t: 'h', html: 'Response and request record' },
      { t: 'list', items: [
        '<code>Results.Accepted(...)</code> returns <strong>HTTP 202</strong>: the demo flow accepted the request. It does <strong>not</strong> mean money has moved.',
        '<code>record TransferRequest</code> defines the request shape. <code>FromAccount</code>, <code>ToAccount</code> and <code>Amount</code> come from the JSON body.',
      ]},
    ]
  },
  {
    part: P4, title: '4.5 Understand the Kafka producer settings',
    body: [
      { t: 'p', html: 'The producer uses only one explicit Kafka setting:' },
      { t: 'diagram', text: `new ProducerConfig
{
    BootstrapServers = kafka
}` },
      { t: 'explain', items: [
        '<code>BootstrapServers</code> is the broker address used to establish the connection.',
        '<code>kafka</code> is the Compose service name, which Docker’s internal DNS resolves to the Kafka container.',
        '<code>9092</code> is the port Kafka listens on for client traffic in this lab.',
        'This is intentionally minimal. Real deployments also configure TLS, authentication, acknowledgements, retries, timeouts, message keys, metrics and other reliability settings.',
      ]},
    ]
  },

  // ───────────────────────── PART 5 ─────────────────────────
  {
    part: P5, title: '5.1 Create a Worker project',
    body: [
      { t: 'code', label: 'Terminal', text: 'dotnet new worker -n NotificationService' },
      { t: 'explain', items: [
        '<code>worker</code> creates a .NET Worker Service template.',
        'A Worker Service suits a program that runs continuously in the background instead of waiting for HTTP requests.',
        'Our notification application will stay running and wait for Kafka messages.',
      ]},
    ]
  },
  {
    part: P5, title: '5.2 Add the Kafka package to this project too',
    body: [
      { t: 'p', html: 'Transfer Service and Notification Service are <strong>separate .NET projects</strong>. Installing a package in one does not install it in the other.' },
      { t: 'code', label: 'Terminal', text: `dotnet add NotificationService package Confluent.Kafka --version 2.8.0
dotnet restore NotificationService` },
      { t: 'explain', items: [
        'The first command adds the Kafka client dependency to Notification Service.',
        'The second command downloads/restores the dependency for this project.',
        'Each independent application declares its own dependencies in its own <code>.csproj</code>.',
      ]},
      { t: 'file', path: 'NotificationService/NotificationService.csproj' },
      { t: 'p', html: 'Confirm it contains a package reference similar to:' },
      { t: 'code', label: 'Look for this', text: CODE.notificationRef },
      { t: 'p', html: 'The template may include additional standard Worker Service settings and files (such as <code>Worker.cs</code>). That is normal.' },
    ]
  },
  {
    part: P5, title: '5.3 Replace the Worker code',
    body: [
      { t: 'file', path: 'NotificationService/Program.cs' },
      { t: 'p', html: 'Replace its contents with:' },
      { t: 'code', label: 'Replace NotificationService/Program.cs', text: CODE.notificationProgram },
    ]
  },
  {
    part: P5, title: '5.4 Explain the consumer code line by line',
    body: [
      { t: 'list', items: [
        '<code>using Confluent.Kafka;</code> imports the Kafka client library we installed.',
        '<code>ConsumerConfig</code> is the settings object for a Kafka consumer. <code>BootstrapServers</code> is the broker address.',
        '<code>GroupId</code> gives this consumer a group name. Kafka uses consumer groups to track reading progress and distribute partitions among consumers in the same group.',
        '<code>AutoOffsetReset.Earliest</code>: when this group has no saved reading position, begin at the earliest available message. It does <strong>not</strong> rewind a group that already has committed offsets.',
        '<code>while (true)</code> keeps the worker running; <code>try</code> lets us catch connection or runtime errors.',
        '<code>ConsumerBuilder&lt;Ignore, string&gt;</code>: keys are ignored, values are text. <code>.Build()</code> creates the consumer.',
        '<code>Subscribe("bank-transfers")</code> says which topic to listen to.',
        '<code>Console.WriteLine</code> prints into the container logs.',
        '<code>Consume()</code> waits for a Kafka message; <code>result.Message.Value</code> is the event text sent by Transfer Service.',
        '<code>catch</code> reports the issue; <code>Task.Delay(...)</code> waits five seconds before retrying.',
      ]},
      { t: 'trainer', title: 'Trainer accuracy note', html: 'This small consumer does not configure manual commits or durable notification delivery. It shows the producer/consumer concept. It does not demonstrate a production message-processing guarantee.' },
    ]
  },

  // ───────────────────────── PART 6 ─────────────────────────
  {
    part: P6, title: '6. Create the Account Service Dockerfile',
    body: [
      { t: 'p', html: 'A <strong>Dockerfile</strong> is a plain text file named exactly <code>Dockerfile</code> (no <code>.txt</code> extension). It contains instructions for building an image.' },
      { t: 'file', path: 'AccountService/Dockerfile' },
      { t: 'code', label: 'New file AccountService/Dockerfile', text: CODE.dockerfile('AccountService', 'aspnet') },
    ]
  },
  {
    part: P6, title: '6. Create the Transfer Service Dockerfile',
    body: [
      { t: 'file', path: 'TransferService/Dockerfile' },
      { t: 'code', label: 'New file TransferService/Dockerfile', text: CODE.dockerfile('TransferService', 'aspnet') },
    ]
  },
  {
    part: P6, title: '6. Create the Notification Service Dockerfile',
    body: [
      { t: 'file', path: 'NotificationService/Dockerfile' },
      { t: 'code', label: 'New file NotificationService/Dockerfile', text: CODE.dockerfile('NotificationService', 'runtime') },
      { t: 'p', html: 'Notice the last stage uses <code>dotnet/runtime</code>, not <code>dotnet/aspnet</code>.' },
    ]
  },
  {
    part: P6, title: '6. Explain the Dockerfile instructions',
    body: [
      { t: 'explain', items: [
        '<code>FROM</code> selects a starting image. The SDK image contains tools to compile .NET applications.',
        '<code>AS build</code> names the first stage.',
        '<code>WORKDIR</code> selects the working directory inside the image.',
        '<code>COPY</code> copies files from the project folder into the image.',
        '<code>RUN</code> executes a command while building the image.',
        '<code>dotnet restore</code> downloads project dependencies.',
        '<code>dotnet publish</code> compiles and prepares deployable application files.',
        'The second <code>FROM</code> starts a fresh runtime-only image.',
        '<code>COPY --from=build</code> copies the published files from the build stage into the runtime stage.',
        '<code>ENTRYPOINT</code> defines the application that runs when the container starts.',
      ]},
      { t: 'trainer', title: 'Why two FROM sections?', html: 'The first stage needs the SDK to compile. The final stage only needs the runtime to execute the compiled application. This is a <strong>multi-stage Docker build</strong>. Account and Transfer are ASP.NET web apps, so they use the ASP.NET runtime image. The Notification Worker is a background process and uses the .NET runtime image.' },
    ]
  },

  // ───────────────────────── PART 7 ─────────────────────────
  {
    part: P7, title: '7.1 Why Kafka needs configuration',
    body: [
      { t: 'p', html: 'Kafka is not just a library inside our C# application. Kafka is a <strong>separate server process</strong> (a broker). We must start that broker and tell it:' },
      { t: 'list', items: [
        'its node identity,',
        'which roles it performs,',
        'which network ports it listens on,',
        'how it finds its controller,',
        'and how it advertises its client address.',
      ]},
      { t: 'p', html: 'We use a single Kafka node in <strong>KRaft mode</strong>. KRaft is Kafka’s built-in metadata quorum mode. It removes the need for a separate ZooKeeper service.' },
    ]
  },
  {
    part: P7, title: '7.2 Kafka configuration used in this lab',
    body: [
      { t: 'p', html: 'This block goes inside <code>docker-compose.yml</code>. We type the full file in Part 9, so <strong>just read it now</strong>.' },
      { t: 'diagram', text: CODE.kafkaService },
      { t: 'explain', items: [
        '<code>image</code>: the prebuilt Kafka image. <code>hostname</code>: the network hostname. <code>container_name</code>: a readable name.',
        '<code>ports</code>: maps host port 9092 to container port 9092.',
        '<code>KAFKA_NODE_ID</code>: unique identifier for this Kafka node.',
        '<code>KAFKA_PROCESS_ROLES</code>: this single node is both broker (handles messages) and controller (manages metadata).',
        '<code>KAFKA_LISTENERS</code>: 9092 for client traffic, 9093 for controller traffic.',
        '<code>KAFKA_ADVERTISED_LISTENERS</code>: the address Kafka tells clients to use. Other containers must use <code>kafka:9092</code>.',
        '<code>KAFKA_CONTROLLER_LISTENER_NAMES</code>: the listener used for controller communication.',
        '<code>KAFKA_LISTENER_SECURITY_PROTOCOL_MAP</code>: these lab listeners use PLAINTEXT. Fine for a local exercise, <strong>not</strong> for production banking.',
        '<code>KAFKA_CONTROLLER_QUORUM_VOTERS</code>: the controller node and its address.',
        'Replication factor settings are <code>1</code> because there is only one broker, so there is no broker-level redundancy.',
        '<code>KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS</code>: reduces the initial consumer-group delay.',
        '<code>KAFKA_AUTO_CREATE_TOPICS_ENABLE</code>: creates a topic when a producer first writes to it. In a controlled environment, create topics explicitly.',
      ]},
      { t: 'warn', title: 'Networking', html: 'Inside Docker Compose, <code>localhost</code> means “this same container.” Transfer and Notification containers connect to <code>kafka:9092</code>, where <code>kafka</code> is the Compose service name resolved by Docker’s internal DNS. This minimal setup advertises only the internal address, so do not assume a host-run Kafka client can use it.' },
    ]
  },

  // ───────────────────────── PART 8 ─────────────────────────
  {
    part: P8, title: '8.1–8.2 Write the Kong configuration',
    body: [
      { t: 'p', html: '<strong>Kong</strong> is an API Gateway. The client sends a request to Kong, and Kong checks the path and forwards it to the correct backend. Without Kong, the client would need every service’s address and port. With Kong it uses one entry point: <code>http://localhost:8000</code>.' },
      { t: 'file', path: 'kong.yml' },
      { t: 'code', label: 'Replace kong.yml', text: CODE.kong },
      { t: 'explain', items: [
        '<code>_format_version</code> identifies the format of the declarative configuration file.',
        '<code>_transform</code> enables Kong’s configuration transformation behaviour for this format.',
        '<code>services</code> is the list of backend applications Kong can forward to. <code>name</code> is a label.',
        '<code>url</code> is the internal address of the backend application.',
        '<code>routes</code> defines which incoming requests use that service. <code>paths</code> lists URL prefixes to match.',
        '<code>strip_path: true</code> removes the matching prefix before forwarding.',
      ]},
      { t: 'table', head: ['Client calls Kong', 'Kong forwards to service'], rows: [
        ['<code>/accounts/100001</code>', 'Account Service receives <code>/100001</code>'],
        ['<code>/transfers/</code>', 'Transfer Service receives <code>/</code>'],
      ]},
      { t: 'trainer', html: 'Why does this work? Account Service has a route <code>/{accountNumber}</code>. Transfer Service has a POST route <code>/</code>. Kong removes <code>/accounts</code> or <code>/transfers</code> so the remaining path matches.' },
    ]
  },
  {
    part: P8, title: '8.3 How Kong reads the file',
    body: [
      { t: 'p', html: 'Kong runs in <strong>DB-less mode</strong>: no separate database for its services and routes. It reads the declarative YAML file. The Compose configuration will:' },
      { t: 'list', items: [
        'set <code>KONG_DATABASE: "off"</code> to enable DB-less mode;',
        'set <code>KONG_DECLARATIVE_CONFIG</code> to the file path inside the Kong container;',
        'mount the local <code>kong.yml</code> into that path;',
        'expose port <code>8000</code> for client requests;',
        'expose Admin API port <code>8001</code> only on the local machine.',
      ]},
      { t: 'p', html: 'The mounted file is read-only (<code>:ro</code>): the container can read it but cannot edit the host’s file through that mount.' },
    ]
  },

  // ───────────────────────── PART 9 ─────────────────────────
  {
    part: P9, title: '9.1 Write docker-compose.yml',
    body: [
      { t: 'p', html: 'A YAML text file describing the containers that make up the lab. YAML uses indentation to show which settings belong to which service. <strong>Indentation matters: use spaces, not tabs.</strong>' },
      { t: 'file', path: 'docker-compose.yml' },
      { t: 'code', label: 'Replace docker-compose.yml', text: CODE.compose },
    ]
  },
  {
    part: P9, title: '9.2 Explain the Compose file section by section',
    body: [
      { t: 'p', html: '<code>services:</code> begins the list of containers Compose should manage.' },
      { t: 'h', html: 'Account Service' },
      { t: 'list', items: [
        '<code>build: ./AccountService</code>: build an image using the Dockerfile in that folder.',
        '<code>environment</code> passes settings into the container. <code>ASPNETCORE_URLS: http://+:8080</code> means listen on port 8080 on all container interfaces.',
        '<code>"5101:8080"</code>: host port 5101 → container port 8080. Left is the host; right is the container.',
      ]},
      { t: 'h', html: 'Transfer Service' },
      { t: 'list', items: [
        '<code>ACCOUNT_URL</code> and <code>KAFKA_BOOTSTRAP</code> tell it where Account Service and Kafka are on the Compose network.',
        '<code>depends_on</code> expresses startup <strong>ordering</strong>. It does not guarantee the dependency is ready.',
        'Port 5102 is exposed on the host for direct testing.',
      ]},
      { t: 'h', html: 'Notification Service' },
      { t: 'list', items: [ 'Built from its own folder; receives the Kafka address; needs no host port because it is a background worker, not an HTTP API.' ]},
      { t: 'h', html: 'Kafka' },
      { t: 'list', items: [ '<code>image</code> uses a published Kafka image instead of building our own; the environment block configures KRaft; the port mapping exposes 9092 on the host.' ]},
      { t: 'h', html: 'Kong' },
      { t: 'list', items: [
        '<code>KONG_DATABASE: "off"</code> selects DB-less mode; <code>KONG_DECLARATIVE_CONFIG</code> points at the file inside the container.',
        'The log variables send logs to standard output/error so Docker can display them.',
        '<code>volumes</code> mounts our local Kong file into the container.',
        '<code>8000:8000</code> exposes the proxy. <code>127.0.0.1:8001:8001</code> exposes the Admin API only on this computer’s loopback. Never expose it publicly.',
      ]},
      { t: 'trainer', title: 'Port mapping, once more', html: '<code>"8000:8000"</code>: the first number is where the participant connects from their laptop; the second is where the process listens inside the container.' },
    ]
  },

  // ───────────────────────── PART 10 ─────────────────────────
  {
    part: P10, title: 'Lab only: forward the test ports',
    body: [
      { t: 'lab', title: 'Web lab step (not in the PDF)', html: 'In this browser VS Code, <code>localhost</code> means the VS Code container itself, which is the same lesson as Part 7. The workshop containers publish their ports on your laptop. Run this once so <code>localhost:5101</code>, <code>5102</code>, <code>8000</code> and <code>8001</code> reach them, and every curl command works exactly as written.' },
      { t: 'code', label: 'Terminal', text: 'lab-ports on' },
      { t: 'p', html: 'Check it with <code>lab-ports status</code>. Turn it off with <code>lab-ports off</code>; you need it off if you repeat Part 3.3’s <code>dotnet run</code> on port 5101.' },
      { t: 'trainer', html: 'This is a good moment to reinforce the idea: <em>“localhost always means the machine or container you are standing in.”</em>' },
    ]
  },
  {
    part: P10, title: '10.1 Validate the Compose file',
    body: [
      { t: 'p', html: 'From the folder containing <code>docker-compose.yml</code>:' },
      { t: 'code', label: 'Terminal', text: 'docker compose config' },
      { t: 'p', html: 'Compose reads the YAML file, checks its structure and prints the resolved configuration. If indentation or YAML structure is wrong, it reports an error. This command <strong>does not start</strong> containers.' },
    ]
  },
  {
    part: P10, title: '10.2 Build and start everything',
    body: [
      { t: 'code', label: 'Terminal 1 (keep it open)', text: 'docker compose up --build' },
      { t: 'explain', items: [
        '<code>docker compose</code> invokes Compose.',
        '<code>up</code> creates and starts the services.',
        '<code>--build</code> builds images for services that have a <code>build</code> section before starting them.',
      ]},
      { t: 'h', html: 'What should happen' },
      { t: 'list', ordered: true, items: [
        'Docker builds Account Service.',
        'Docker builds Transfer Service and restores its NuGet dependencies during the image build.',
        'Docker builds Notification Service and restores its NuGet dependencies.',
        'Docker downloads the Kafka and Kong images if they are not already present.',
        'Compose creates a private network.',
        'Compose starts the containers.',
      ]},
      { t: 'p', html: 'The first build may take several minutes. Keep this terminal open to see the logs, and open another terminal for tests.' },
      { t: 'warn', html: '<code>depends_on</code> does not mean Kafka is ready. Wait until Kafka’s logs show it has started before sending the first transfer. If the first request fails while Kafka is starting, wait and retry.' },
    ]
  },
  {
    part: P10, title: '10.3 Check container status',
    body: [
      { t: 'code', label: 'Terminal 2', text: 'docker compose ps' },
      { t: 'list', items: [
        '<code>ps</code> lists the containers managed by this Compose project.',
        'Check that the Account, Transfer, Notification, Kafka and Kong containers are running.',
        'The Notification Service should log that it is waiting for transfer events.',
      ]},
      { t: 'p', html: 'If a service exited, inspect its logs:' },
      { t: 'code', label: 'Terminal 2', text: `docker compose logs account-service
docker compose logs transfer-service
docker compose logs notification-service
docker compose logs kafka
docker compose logs kong` },
    ]
  },
  {
    part: P10, title: '10.4 Useful Compose commands',
    body: [
      { t: 'code', label: 'Follow one service’s logs (-f = follow)', text: 'docker compose logs -f notification-service' },
      { t: 'code', label: 'Stop a container without deleting it', text: 'docker compose stop notification-service' },
      { t: 'code', label: 'Start the stopped container again', text: 'docker compose start notification-service' },
      { t: 'code', label: 'Stop and remove containers + network (source code is kept)', text: 'docker compose down' },
      { t: 'trainer', html: 'Only explain these commands now. Do <strong>not</strong> run <code>down</code> yet; we need everything running for Part 11.' },
    ]
  },

  // ───────────────────────── PART 11 ─────────────────────────
  {
    part: P11, title: '11.1 Demo A: Account Service directly',
    body: [
      { t: 'code', label: 'Terminal 2', text: `curl http://localhost:5101/health
curl http://localhost:5101/100001
curl -i http://localhost:5101/999999` },
      { t: 'explain', items: [
        '<code>curl</code> sends an HTTP request from the terminal.',
        '<code>localhost</code> means this training computer; <code>5101</code> is the host port mapped to Account Service.',
        '<code>/health</code> checks availability; <code>/100001</code> requests that account.',
        '<code>-i</code> includes HTTP response headers so participants can see the status code.',
      ]},
      { t: 'expected', html: 'Amina’s account for <code>100001</code>; <code>404</code> for the unknown account.' },
    ]
  },
  {
    part: P11, title: '11.2 Demo B: Account Service through Kong',
    body: [
      { t: 'code', label: 'Terminal 2', text: 'curl http://localhost:8000/accounts/100001' },
      { t: 'h', html: 'Explain the route' },
      { t: 'list', ordered: true, items: [
        'The client connects to port 8000, which belongs to Kong.',
        'Kong matches the <code>/accounts</code> path.',
        'Kong selects its <code>account-service</code> upstream.',
        'Kong removes <code>/accounts</code> because <code>strip_path</code> is true.',
        'Kong forwards <code>/100001</code> to <code>http://account-service:8080</code>.',
        'Account Service returns JSON.',
        'Kong passes that response back to the client.',
      ]},
      { t: 'p', html: 'Compare: direct uses <code>localhost:5101</code>. Gateway uses <code>localhost:8000/accounts/100001</code>.' },
      { t: 'trainer', html: 'Ask: <em>“Which URL would a mobile app use if we want all client traffic to pass through the gateway?”</em> Expected: the Kong URL.' },
    ]
  },
  {
    part: P11, title: '11.3 Demo C: submit a transfer',
    body: [
      { t: 'p', html: 'Keep the terminal running <code>docker compose up</code> visible. In another terminal:' },
      { t: 'code', label: 'Terminal 2', text: CODE.transferCurl },
      { t: 'explain', items: [
        '<code>-i</code> shows the HTTP status and headers; <code>-X POST</code> selects the POST method.',
        'The URL sends the request to Kong.',
        '<code>-H "Content-Type: application/json"</code> tells the API the body is JSON; <code>-d</code> supplies the body.',
        '<code>fromAccount</code> is the source, <code>toAccount</code> the destination, <code>amount</code> the sample amount.',
      ]},
      { t: 'expected', html: '<strong>HTTP 202 Accepted</strong> and a generated transfer ID.' },
      { t: 'h', html: 'The actual code flow' },
      { t: 'list', ordered: true, items: [
        'Kong forwards the request to Transfer Service.',
        'Transfer Service validates that amount is greater than zero.',
        'Transfer Service calls Account Service to look up the source account.',
        'Account Service returns the account details if it exists.',
        'Transfer Service creates a unique ID.',
        'Transfer Service converts the event data into JSON.',
        'Transfer Service publishes the event to Kafka topic <code>bank-transfers</code>.',
        'Transfer Service returns HTTP 202.',
      ]},
      { t: 'warn', title: 'Do not say this completed a bank transfer', html: 'It only demonstrated a request and an event. The code does not debit the sender or credit the receiver.' },
    ]
  },
  {
    part: P11, title: '11.4 Demo D: watch the Kafka consumer',
    body: [
      { t: 'code', label: 'Terminal 3', text: 'docker compose logs -f notification-service' },
      { t: 'list', items: [
        'This follows the logs of only the Notification Service container.',
        'After the transfer is published, it prints a line containing the event JSON.',
        'Transfer Service is the <strong>producer</strong>. Kafka is the <strong>broker</strong>. <code>bank-transfers</code> is the <strong>topic</strong>. Notification Service is the <strong>consumer</strong>.',
      ]},
      { t: 'h', html: 'Show the separation' },
      { t: 'list', items: [
        'Transfer Service does not call Notification Service over HTTP.',
        'Transfer Service writes to Kafka.',
        'Notification Service independently reads from Kafka.',
        'If Notification Service is offline temporarily, the producer can still publish while Kafka is available. The event remains for a consumer to read, subject to retention and consumer offsets.',
      ]},
      { t: 'expected', html: '<code>NOTIFICATION: Transfer event received: {"transferId":"…","FromAccount":"100001",…}</code>' },
    ]
  },
  {
    part: P11, title: '11.5 Demo E: the consumer is independent',
    body: [
      { t: 'p', html: 'Stop the Notification Service:' },
      { t: 'code', label: 'Terminal 2', text: 'docker compose stop notification-service' },
      { t: 'p', html: 'Send another transfer:' },
      { t: 'code', label: 'Terminal 2', text: CODE.transferCurl },
      { t: 'p', html: 'Transfer Service can still publish to Kafka if Kafka is running. It does not need the Notification Service to be online.' },
      { t: 'p', html: 'Start Notification Service again and watch it:' },
      { t: 'code', label: 'Terminal 2', text: `docker compose start notification-service
docker compose logs -f notification-service` },
      { t: 'trainer', html: 'The consumer group and offset decide which messages it reads. <code>AutoOffsetReset.Earliest</code> applies only when the group has no committed offset. This simplified consumer does not demonstrate manual acknowledgement or a production delivery guarantee.' },
    ]
  },
  {
    part: P11, title: '11.6 Demo F: input validation',
    body: [
      { t: 'p', html: 'Zero amount:' },
      { t: 'code', label: 'Terminal 2', text: `curl -i -X POST http://localhost:8000/transfers/ \\
  -H "Content-Type: application/json" \\
  -d '{"fromAccount":"100001","toAccount":"100002","amount":0}'` },
      { t: 'expected', html: '<strong>HTTP 400 Bad Request</strong>: amount must be greater than zero.' },
      { t: 'p', html: 'Unknown source account:' },
      { t: 'code', label: 'Terminal 2', text: `curl -i -X POST http://localhost:8000/transfers/ \\
  -H "Content-Type: application/json" \\
  -d '{"fromAccount":"999999","toAccount":"100002","amount":5000}'` },
      { t: 'expected', html: 'A bad-request response saying <em>the source account was not found</em>.' },
    ]
  },

  // ───────────────────────── PART 12 ─────────────────────────
  {
    part: P12, title: '12. Ask participants to explain the flow',
    body: [
      { t: 'trainer', title: 'Without reading the screen', html: 'Hide the guide (<code>G</code>) and ask participants to explain:' },
      { t: 'list', ordered: true, items: [
        'The client sends a request to Kong.',
        'Kong matches the URL path and forwards it to Transfer Service.',
        'Transfer Service uses HTTP to ask Account Service whether the source account exists.',
        'Account Service returns a response.',
        'Transfer Service publishes a JSON event to Kafka.',
        'Kafka stores the event in the <code>bank-transfers</code> topic.',
        'Notification Service consumes the event and prints it.',
        'Transfer Service returns HTTP 202 to the original client.',
      ]},
      { t: 'table', head: ['Ask', 'Answer'], rows: [
        ['Which call is synchronous?', 'The HTTP lookup.'],
        ['Which communication is asynchronous?', 'The Kafka event.'],
        ['Which component is the API gateway?', 'Kong.'],
        ['Which application publishes the event?', 'Transfer Service.'],
        ['Which application reads the event?', 'Notification Service.'],
        ['Where do containers find one another?', 'On the Compose network using service names.'],
      ]},
    ]
  },

  // ───────────────────────── PART 13 ─────────────────────────
  {
    part: P13, title: '13. Troubleshooting with participants',
    body: [
      { t: 'table', head: ['Symptom', 'Explain / check this'], rows: [
        ['<code>docker: command not found</code>', 'Docker is not installed or the terminal cannot find it. Install/start Docker and reopen the terminal.'],
        ['Docker daemon unavailable', 'Docker Desktop/Engine is not running. Start it.'],
        ['<code>dotnet: command not found</code>', '.NET SDK is not installed or not on PATH. Install .NET 10 SDK.'],
        ['NuGet restore fails', 'Check internet access and the package source; run <code>dotnet restore TransferService</code> or <code>dotnet restore NotificationService</code> again.'],
        ['YAML indentation error', 'YAML depends on spaces. Check indentation in <code>docker-compose.yml</code> and <code>kong.yml</code>; do not use tabs.'],
        ['Port is already allocated', 'Another application uses that host port. Stop it or change the left-hand side of the port mapping.'],
        ['Kong returns 502', 'Kong cannot reach the upstream. Check service status and logs; verify service names and container port 8080.'],
        ['Account route returns 404', 'Check the path and <code>strip_path</code>; Account Service expects <code>/{accountNumber}</code> after Kong removes <code>/accounts</code>.'],
        ['Transfer reports Kafka error', 'Kafka may not be ready. Check <code>docker compose logs kafka</code>, wait for startup and retry.'],
        ['No notification printed', 'Check Kafka, consumer logs, topic name spelling and whether a new transfer request was sent.'],
        ['Container uses wrong address', 'Inside a container, <code>localhost</code> means that same container. Use <code>account-service:8080</code> or <code>kafka:9092</code>.'],
        ['<em>Lab:</em> curl to localhost fails in this VS Code', 'Run <code>lab-ports on</code> (see Part 10).'],
        ['<em>Lab:</em> <code>dotnet run</code> says port 5101 is in use', 'Run <code>lab-ports off</code> first.'],
      ]},
    ]
  },

  // ───────────────────────── PART 14 ─────────────────────────
  {
    part: P14, title: '14. What this example does not do',
    body: [
      { t: 'p', html: 'Explain the limits openly. The example is small because the training goal is to understand the building blocks. It does not include:' },
      { t: 'list', items: [
        'A database or persistent account balances.',
        'A real double-entry ledger.',
        'Funds availability validation.',
        'Debit and credit posting.',
        'Durable idempotency or duplicate-request protection.',
        'Transactional outbox for reliable database-to-Kafka publishing.',
        'Reversals, settlement or reconciliation.',
        'Authentication, authorisation, TLS, secrets management or audit-grade logging.',
        'Multi-broker Kafka replication or disaster recovery.',
        'Production health checks, readiness checks, monitoring and alerting.',
        'Kong high availability or production-grade gateway policies.',
      ]},
      { t: 'h', html: 'Two specific lab trade-offs' },
      { t: 'list', ordered: true, items: [
        '<code>depends_on</code> gives startup ordering but does not prove Kafka is ready. Production needs readiness checks and retry behaviour designed and tested deliberately.',
        'This Kafka broker uses PLAINTEXT and one node with replication factor 1. It is a local learning setup only.',
      ]},
    ]
  },
  {
    part: P14, title: 'Final trainer message',
    body: [
      { t: 'trainer', title: 'Say', html: '“Today we built a small example, not a complete banking platform. We created three independent services, packaged them with Docker, started and connected them with Docker Compose, routed API traffic through Kong, and used Kafka to pass an event from one service to another. The important lesson is understanding what each component does and how the pieces communicate. Real banking systems add security, persistence, ledger controls, reliability, auditability and operational safeguards before handling real transactions.”' },
      { t: 'h', html: 'Clean up' },
      { t: 'code', label: 'Terminal', text: `docker compose down
lab-ports off` },
      { t: 'lab', html: 'Live-coding from scratch next time? Run <code>./stop.sh</code>, then <code>./start.sh workspace</code> for an empty folder. See <code>lab/README.md</code>.' },
    ]
  },
];
