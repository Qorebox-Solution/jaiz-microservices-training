# Jaiz Bank — Microservices Lab

A deliberately small teaching demo with three services:
- Account Service: returns two sample accounts.
- Transfer Service: checks that the source account exists, then publishes a transfer event to Kafka.
- Notification Service: consumes the event and prints it.

Kong routes external requests to the two HTTP services.

## Web lab (trainer guide + VS Code in one browser tab)
Teach without switching between the PDF and your editor:

```bash
cd lab && ./start.sh      # then open http://localhost:3000
```

See [lab/README.md](lab/README.md).

## Requirements
- Docker Desktop / Docker Engine with Compose
- .NET 10 SDK (only if you want to run services outside Docker)

## Start everything
From this folder:

```bash
docker compose up --build
```

Wait for the services to start. In another terminal, test the Account Service through Kong:

```bash
curl http://localhost:8000/accounts/100001
```

Expected response includes Amina Yusuf and a balance of 250000.

Send a sample transfer:

```bash
curl -X POST http://localhost:8000/transfers/ \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"100001","toAccount":"100002","amount":5000}'
```

Expected response: HTTP 202 with a transfer ID and an accepted status.

Watch the terminal running `docker compose up`: Notification Service should print the event it receives.

## Useful commands

```bash
docker compose ps
docker compose logs -f notification-service
docker compose logs -f transfer-service
docker compose down
```

## What to explain
1. Kong is the single entry point. It forwards `/accounts/...` and `/transfers/...`.
2. Transfer Service makes a synchronous HTTP call to Account Service.
3. Transfer Service publishes an event to Kafka.
4. Notification Service consumes that event independently.

## Important training limitation
This is a teaching demonstration, NOT a real banking transfer system. It does not debit or credit accounts, keep balances in a database, authenticate users, implement durable idempotency, or provide production-grade reliability/security. Do not connect it to real bank systems or customer data. Kafka is configured as a single-node lab broker.
