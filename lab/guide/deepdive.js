/* Configuration deep-dive: Docker Compose, Kong, Kafka.
 * Inserted after Part 11 (the system is running by then).
 * Every experiment here was run against the real stack; the "Expected" boxes show what actually happens.
 */
(function () {
  const DC = 'Deep-dive A — Docker Compose config';
  const DK = 'Deep-dive B — Kong config';
  const DF = 'Deep-dive C — Kafka config';

  const T = `-H "Content-Type: application/json" \\
  -d '{"fromAccount":"100001","toAccount":"100002","amount":5000}'`;
  const transfer = `curl -i -X POST http://localhost:8000/transfers/ \\
  ${T}`;

  const resetNote = (file) =>
    `<strong>Undo:</strong> change the line back and save. Working in the repo folder? <code>git checkout -- ${file}</code> restores it.`;

  // ───────────── Notes for the click-a-line viewers ─────────────
  const composeNotes = [
    ['services:', '<p>Top-level list of containers this Compose project manages. Each key below it (<code>account-service</code>, <code>kafka</code>…) is a <strong>service name</strong>. That name is also the container’s <strong>DNS name</strong> on the Compose network.</p>'],
    ['  account-service:', '<p>Service name. Other containers reach it at <code>http://account-service:8080</code>, which is why <code>kong.yml</code> and <code>ACCOUNT_URL</code> use this exact name.</p><p class="bad">Rename it here without updating kong.yml/ACCOUNT_URL → Kong 502 / transfer fails.</p>'],
    ['  transfer-service:', '<p>Service name used by Kong (<code>http://transfer-service:8080</code>).</p>'],
    ['  notification-service:', '<p>Background worker. It has no <code>ports:</code> section because nothing calls it over HTTP. It only reads from Kafka.</p>'],
    ['  kafka:', '<p>The Kafka broker service. Its name <code>kafka</code> is what <code>KAFKA_BOOTSTRAP: kafka:9092</code> points at.</p>'],
    ['  kong:', '<p>The API gateway service: the single public entry point on port 8000.</p>'],
    ['build:', '<p>Build an image from the <code>Dockerfile</code> in this folder (instead of downloading one). <code>docker compose up --build</code> rebuilds it after code changes.</p>'],
    ['image:', '<p>Use a ready-made image from a registry. The tag after <code>:</code> pins the version (<code>kong:3.9</code>, <code>apache/kafka:4.0.0</code>). Pinning keeps every laptop on the same version.</p>'],
    ['environment:', '<p>Settings passed into the container as <strong>environment variables</strong>. The C# code reads them with <code>Environment.GetEnvironmentVariable(...)</code>. Kafka and Kong read theirs at start-up.</p><p>Changing one needs <code>docker compose up -d &lt;service&gt;</code> (recreate). A plain restart keeps the old values.</p>'],
    ['ASPNETCORE_URLS', '<p>Tells ASP.NET to listen on port <strong>8080</strong> on all interfaces (<code>+</code>) <em>inside</em> the container. The right-hand side of the port mapping and the Kong URLs must use this same 8080.</p>'],
    ['ACCOUNT_URL', '<p>Where Transfer Service finds Account Service: service name + container port. <strong>Not</strong> <code>localhost</code>: inside a container, localhost is the container itself (see Experiment A2).</p>'],
    ['KAFKA_BOOTSTRAP', '<p>First Kafka address the client contacts: <code>kafka</code> (service name) + <code>9092</code> (client listener).</p>'],
    ['depends_on:', '<p><strong>Start order only.</strong> Compose starts these first, but does <em>not</em> wait until they are ready. Kafka can still be booting when Transfer Service starts, which is why the first request may fail.</p>'],
    ['- account-service', '<p>Dependency: start <code>account-service</code> before this one.</p>'],
    ['- transfer-service', '<p>Dependency: start <code>transfer-service</code> before this one.</p>'],
    ['- kafka', '<p>Dependency: start <code>kafka</code> before this one.</p>'],
    ['ports:', '<p>Publishes container ports on <strong>your laptop</strong>: <code>"HOST:CONTAINER"</code>. Only needed for traffic coming from outside Docker. Containers talk to each other directly, without these.</p>'],
    ['"5101:8080"', '<p>Laptop port <strong>5101</strong> → container port <strong>8080</strong>. Lets you test Account Service directly, bypassing Kong.</p><p class="bad">Change the right side to 80 → direct calls fail, but Kong still works (Experiment A1).</p>'],
    ['"5102:8080"', '<p>Laptop port 5102 → Transfer Service’s 8080, for direct testing.</p>'],
    ['"9092:9092"', '<p>Publishes Kafka on the laptop. Our services don’t need this (they use the Compose network). Also, Kafka advertises <code>kafka:9092</code>, so a laptop client would still need an extra listener.</p>'],
    ['"8000:8000"', '<p>Kong’s <strong>proxy</strong> port: the URL clients use, <code>http://localhost:8000</code>.</p>'],
    ['"127.0.0.1:8001:8001"', '<p>Kong’s <strong>Admin API</strong>, bound to <code>127.0.0.1</code> so only this laptop can reach it. Plain <code>"8001:8001"</code> would expose it to the whole network. Anyone could then read or change the gateway config.</p>'],
    ['hostname: kafka', '<p>Hostname inside the container. It matches the service name, so Kafka’s own <code>1@kafka:9093</code> controller address resolves.</p>'],
    ['container_name', '<p>Fixed, readable container name (<code>jaiz-kafka</code>) instead of the generated <code>&lt;project&gt;-kafka-1</code>. Only one such container can exist per machine.</p>'],
    ['KAFKA_', '<p>Kafka broker settings. See <strong>Deep-dive C</strong> for each one.</p>'],
    ['KONG_DATABASE', '<p><code>"off"</code> = <strong>DB-less mode</strong>: Kong reads routes from a YAML file instead of a database. Quoted so YAML treats it as text, not the boolean <em>false</em>.</p>'],
    ['KONG_DECLARATIVE_CONFIG', '<p>Path of that YAML file <em>inside</em> the Kong container. It must match the right-hand side of the volume below.</p>'],
    ['KONG_PROXY_ACCESS_LOG', '<p>The four <code>*_LOG</code> settings send Kong’s logs to stdout/stderr, so <code>docker compose logs kong</code> shows them.</p>'],
    ['KONG_ADMIN_ACCESS_LOG', '<p>Admin API access log → stdout.</p>'],
    ['KONG_PROXY_ERROR_LOG', '<p>Proxy errors → stderr (visible in <code>docker compose logs kong</code>).</p>'],
    ['KONG_ADMIN_ERROR_LOG', '<p>Admin API errors → stderr.</p>'],
    ['KONG_ADMIN_LISTEN', '<p>Admin API listens on 8001 on all interfaces <em>inside</em> the container. The port mapping then limits it to the laptop’s loopback.</p>'],
    ['volumes:', '<p>Mounts files from your laptop into the container: <code>"HOST_PATH:CONTAINER_PATH[:ro]"</code>.</p>'],
    ['./kong.yml:/kong/kong.yml:ro', '<p>Our <code>kong.yml</code> appears inside Kong at <code>/kong/kong.yml</code>, <strong>read-only</strong> (<code>:ro</code>). Edit the file on the laptop, then <code>docker compose restart kong</code> to load it.</p>'],
  ];

  const kongNotes = [
    ['_format_version', '<p>Version of Kong’s declarative-config format. Kong 3.x expects <code>"3.0"</code>.</p>'],
    ['_transform', '<p>Lets Kong transform values on load (e.g. hashing credentials) for this format.</p>'],
    ['services:', '<p>A Kong <strong>service</strong> = one backend application Kong can forward to.</p>'],
    ['name: account-service', '<p>Label for the Kong service. It’s a Kong name and does not have to match the Compose name. The <code>url</code> is what matters.</p>'],
    ['name: transfer-service', '<p>Label for the second Kong service.</p>'],
    ['url: http://account-service:8080', '<p>Where Kong sends traffic: Compose service name + <strong>container</strong> port (not 5101). Kong runs on the Compose network, so it uses the internal address.</p><p class="bad">Wrong port (e.g. 9999) → 502 Bad Gateway (Experiment B2).</p>'],
    ['url: http://transfer-service:8080', '<p>Internal address of Transfer Service.</p>'],
    ['routes:', '<p>A <strong>route</strong> decides which incoming requests go to the service above it.</p>'],
    ['name: account-route', '<p>Label for the route.</p>'],
    ['name: transfer-route', '<p>Label for the route.</p>'],
    ['paths:', '<p>URL prefixes this route matches. Anything starting with the prefix goes to this service.</p>'],
    ['- /accounts', '<p><code>/accounts</code>, <code>/accounts/100001</code>… all match this route.</p>'],
    ['- /transfers', '<p><code>/transfers/</code> matches this route.</p>'],
    ['strip_path: true', '<p>Remove the matched prefix before forwarding: <code>/accounts/100001</code> → <code>/100001</code>. Our services define routes without the prefix (<code>/{accountNumber}</code>, <code>/</code>).</p><p class="bad">Set to false → the service receives <code>/accounts/100001</code> → 404 (Experiment B1).</p>'],
  ];

  const kafkaNotes = [
    ['image: apache/kafka', '<p>Official Apache Kafka image, version 4.0.0 (KRaft only, no ZooKeeper).</p>'],
    ['hostname: kafka', '<p>Container hostname. It must match the names used in the listener settings below.</p>'],
    ['container_name', '<p>Readable fixed name: <code>docker logs jaiz-kafka</code>.</p>'],
    ['ports:', '<p>Publishes the client port on the laptop (not used by our containers).</p>'],
    ['"9092:9092"', '<p>Laptop 9092 → container 9092.</p>'],
    ['environment:', '<p>The Kafka image turns every <code>KAFKA_X_Y</code> variable into the broker setting <code>x.y</code> (e.g. <code>KAFKA_NODE_ID</code> → <code>node.id</code>).</p>'],
    ['KAFKA_NODE_ID', '<p><code>node.id</code>: unique number for this Kafka node in the cluster. Referenced by <code>1@kafka:9093</code> below.</p>'],
    ['KAFKA_PROCESS_ROLES', '<p>This one node is both <strong>broker</strong> (stores and serves messages) and <strong>controller</strong> (manages cluster metadata). Production separates them across several nodes.</p>'],
    ['KAFKA_LISTENERS', '<p>Where Kafka <strong>listens</strong>: <code>PLAINTEXT</code> on 9092 for clients, <code>CONTROLLER</code> on 9093 for metadata traffic. Empty host = all interfaces.</p>'],
    ['KAFKA_ADVERTISED_LISTENERS', '<p>The address Kafka <strong>tells clients to use</strong> after the first contact. Clients bootstrap on <code>kafka:9092</code>, ask “where is the leader?”, and get this answer. It must be reachable <em>from the client</em>.</p><p class="bad">Set it to localhost:9092 → containers connect to themselves and publishing fails (Experiment C2).</p>'],
    ['KAFKA_CONTROLLER_LISTENER_NAMES', '<p>Which listener name is used for controller traffic (the 9093 one).</p>'],
    ['KAFKA_LISTENER_SECURITY_PROTOCOL_MAP', '<p>Maps each listener name to a security protocol. Both are <code>PLAINTEXT</code>: no TLS, no authentication. Fine for a laptop lab, <strong>never</strong> for banking traffic (that uses SSL/SASL).</p>'],
    ['KAFKA_CONTROLLER_QUORUM_VOTERS', '<p>Controller voters: <code>nodeId@host:port</code>. Here only node 1 at <code>kafka:9093</code>. A real cluster lists 3 or 5 voters, so it survives a failure.</p>'],
    ['KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR', '<p>Copies of the internal <code>__consumer_offsets</code> topic (where group progress is stored). Must be 1 here: you can’t have more copies than brokers.</p>'],
    ['KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR', '<p>Copies of the internal transaction-state topic: 1 broker → 1 copy.</p>'],
    ['KAFKA_TRANSACTION_STATE_LOG_MIN_ISR', '<p>Minimum in-sync copies for transaction state: 1 (single broker).</p>'],
    ['KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS', '<p>How long a new consumer group waits for more members before assigning partitions. 0 = start immediately (default is 3 s).</p>'],
    ['KAFKA_AUTO_CREATE_TOPICS_ENABLE', '<p>Create <code>bank-transfers</code> automatically on first use (1 partition). Convenient for a lab. In production, topics are created explicitly with chosen partitions, replication and retention.</p>'],
    ['kafka:', '<p>Service name. Other containers reach the broker at <code>kafka:9092</code>, which is the value of <code>KAFKA_BOOTSTRAP</code>.</p>'],
  ];

  const steps = [
    // ═════════════ A — DOCKER COMPOSE ═════════════
    {
      part: DC, title: 'A.0 Read docker-compose.yml line by line',
      body: [
        { t: 'p', html: 'Project this and click through it with the room. Highlighted lines have an explanation, and a <span style="color:#ff8a8a">red line</span> says what breaks if it’s wrong.' },
        { t: 'annotated', label: 'docker-compose.yml', text: CODE.compose, notes: composeNotes },
        { t: 'trainer', html: 'Key message: <strong>three kinds of address</strong>. (1) <code>localhost:5101</code> = laptop → container through a published port. (2) <code>account-service:8080</code> = container → container on the Compose network. (3) <code>localhost</code> inside a container = that container itself.' },
      ]
    },
    {
      part: DC, title: 'A.1 Inspect the running Compose project',
      body: [
        { t: 'p', html: 'Show that what we wrote in YAML is now real.' },
        { t: 'code', label: 'Which containers, which ports', text: 'docker compose ps' },
        { t: 'code', label: 'Where is container port 8080 published?', text: 'docker compose port account-service 8080' },
        { t: 'expected', html: '<code>0.0.0.0:5101</code>: the left side of <code>"5101:8080"</code>.' },
        { t: 'code', label: 'The private network Compose created', text: 'docker network ls\ndocker network inspect jaiz-microservices-lab_default --format \'{{range .Containers}}{{.Name}}  {{.IPv4Address}}{{"\\n"}}{{end}}\'' },
        { t: 'expected', html: 'All five containers on one network, each with its own IP (e.g. <code>172.19.0.3/16</code>). The network is named after the folder: <code>&lt;folder&gt;_default</code>.' },
        { t: 'code', label: 'Docker DNS: ask Transfer Service how it resolves names', text: 'docker compose exec transfer-service getent hosts account-service kafka kong' },
        { t: 'expected', html: 'Each service name resolves to the IP shown above. That’s how <code>http://account-service:8080</code> works.' },
        { t: 'code', label: 'See the final config with all values resolved', text: 'docker compose config' },
        { t: 'lab', html: 'If your folder has a different name, the network will be <code>&lt;folder&gt;_default</code>. Check with <code>docker network ls</code>.' },
      ]
    },
    {
      part: DC, title: 'A.2 Experiment: break the container port',
      body: [
        { t: 'p', html: '<strong>Question for the room first:</strong> <em>“If I change Account Service’s mapping to <code>\"5101:80\"</code>, what stops working: the direct URL, the Kong URL, or both?”</em>' },
        { t: 'file', path: 'docker-compose.yml' },
        { t: 'p', html: 'Under <code>account-service</code>, change <code>- "5101:8080"</code> to:' },
        { t: 'code', label: 'Edit (account-service → ports)', text: '      - "5101:80"' },
        { t: 'code', label: 'Recreate just that container, then test both paths', text: `docker compose up -d account-service
curl http://localhost:5101/100001
curl http://localhost:8000/accounts/100001` },
        { t: 'expected', html: 'Direct call <strong>fails</strong> (<em>Recv failure / connection reset</em>): nothing listens on port 80 inside the container. Through Kong it <strong>still returns Amina</strong>.' },
        { t: 'trainer', title: 'Why', html: 'Port mappings only affect traffic from the <strong>laptop</strong>. Kong talks to <code>account-service:8080</code> directly on the Compose network and never uses the mapping.' },
        { t: 'p', html: resetNote('docker-compose.yml') + ' Then:' },
        { t: 'code', label: 'Restore', text: 'docker compose up -d account-service' },
      ]
    },
    {
      part: DC, title: 'A.3 Experiment: use localhost inside a container',
      body: [
        { t: 'p', html: '<strong>Ask:</strong> <em>“Someone sets <code>ACCOUNT_URL</code> to <code>http://localhost:8080</code>. What will Transfer Service call?”</em>' },
        { t: 'file', path: 'docker-compose.yml' },
        { t: 'p', html: 'Under <code>transfer-service → environment</code>, change the line to:' },
        { t: 'code', label: 'Edit (transfer-service → environment)', text: '      ACCOUNT_URL: http://localhost:8080' },
        { t: 'code', label: 'Recreate Transfer Service and send a valid transfer', text: `docker compose up -d transfer-service
${transfer}` },
        { t: 'expected', html: '<strong>HTTP 400 “Source account was not found”</strong>, even though account 100001 exists.' },
        { t: 'trainer', title: 'Why', html: 'Inside the Transfer container, <code>localhost:8080</code> is <strong>Transfer Service itself</strong>, which also listens on 8080. It sent <code>GET /100001</code> to itself, got 404 (it has no such route), and reported “not found.” This is the most common container mistake.' },
        { t: 'p', html: resetNote('docker-compose.yml') + ' Then:' },
        { t: 'code', label: 'Restore', text: 'docker compose up -d transfer-service' },
      ]
    },
    {
      part: DC, title: 'A.4 Check questions: Docker Compose',
      body: [
        { t: 'quiz', items: [
          { q: 'In <code>"5101:8080"</code>, which number is the laptop and which is the container?', a: '5101 is the laptop (host). 8080 is inside the container.' },
          { q: 'Why does Notification Service have no <code>ports:</code> section?', a: 'Nothing calls it over HTTP. It only reads from Kafka, so no port needs publishing.' },
          { q: 'What is the difference between <code>"8001:8001"</code> and <code>"127.0.0.1:8001:8001"</code>?', a: 'The first publishes the Admin API on every network interface, so other machines can reach it. The second only on the laptop’s loopback, so only this laptop can.' },
          { q: 'Does <code>depends_on: kafka</code> guarantee Kafka is ready before Transfer Service starts?', a: 'No. It only controls start order. Readiness needs health checks plus retry logic.' },
          { q: 'You changed an <code>environment</code> value. Is <code>docker compose restart</code> enough?', a: 'No. Restart keeps the old container and its old variables. Use <code>docker compose up -d &lt;service&gt;</code> to recreate it.' },
          { q: 'How does Kong find <code>account-service</code>?', a: 'Docker’s built-in DNS on the Compose network resolves the service name to the container’s IP.' },
        ]},
      ]
    },

    // ═════════════ B — KONG ═════════════
    {
      part: DK, title: 'B.0 Read kong.yml line by line',
      body: [
        { t: 'annotated', label: 'kong.yml', text: CODE.kong, notes: kongNotes },
        { t: 'table', head: ['Client sends to Kong', 'Route matched', 'Service receives'], rows: [
          ['<code>GET /accounts/100001</code>', 'account-route', '<code>GET /100001</code>'],
          ['<code>POST /transfers/</code>', 'transfer-route', '<code>POST /</code>'],
          ['<code>GET /payments</code>', '(none)', 'Kong answers 404 itself'],
        ]},
      ]
    },
    {
      part: DK, title: 'B.1 Inspect Kong live',
      body: [
        { t: 'lab', html: 'Needs <code>lab-ports on</code> (done in Part 10).' },
        { t: 'code', label: 'Kong adds its own headers to every response', text: 'curl -i http://localhost:8000/accounts/100001' },
        { t: 'expected', html: '<code>Via: 1.1 kong/3.9.x</code>, <code>X-Kong-Upstream-Latency</code> (time spent in Account Service) and <code>X-Kong-Proxy-Latency</code> (time spent in Kong). This proves the request went through the gateway.' },
        { t: 'code', label: 'A path with no route: Kong itself answers', text: 'curl -i http://localhost:8000/payments' },
        { t: 'expected', html: '<code>404</code> with <code>"no Route matched with those values"</code>. That reply comes from Kong, not from a service.' },
        { t: 'code', label: 'Admin API: what Kong loaded from kong.yml', text: `curl -s http://localhost:8001/services | jq '.data[] | {name, host, port}'
curl -s http://localhost:8001/routes | jq '.data[] | {name, paths, strip_path}'` },
        { t: 'expected', html: 'The two services (<code>host: account-service, port: 8080</code>…) and the two routes with <code>strip_path: true</code>. This is the YAML we wrote, now live inside Kong.' },
        { t: 'code', label: 'Watch Kong’s access log while you send requests', text: 'docker compose logs -f kong' },
        { t: 'trainer', html: 'Point out that port <strong>8001</strong> is the Admin API. Whoever can reach it can read and change the gateway, which is why Compose binds it to <code>127.0.0.1</code>.' },
      ]
    },
    {
      part: DK, title: 'B.2 Experiment: turn off strip_path',
      body: [
        { t: 'file', path: 'kong.yml' },
        { t: 'p', html: 'Under <code>account-route</code>, change <code>strip_path: true</code> to:' },
        { t: 'code', label: 'Edit (account-route)', text: '        strip_path: false' },
        { t: 'code', label: 'Kong reads kong.yml at start-up, so restart it, then test', text: `docker compose restart kong
curl -i http://localhost:8000/accounts/100001
docker compose logs --tail 3 account-service` },
        { t: 'expected', html: '<strong>404</strong> with an empty body. Account Service’s log shows: <code>Request path: GET http://account-service:8080/accounts/100001 … 404</code>.' },
        { t: 'trainer', title: 'Why', html: 'Kong forwarded the full path. Account Service only knows <code>/{accountNumber}</code> (one segment), so <code>/accounts/100001</code> matches nothing. Gateway and service must agree on paths.' },
        { t: 'p', html: resetNote('kong.yml') + ' Then:' },
        { t: 'code', label: 'Restore', text: 'docker compose restart kong' },
      ]
    },
    {
      part: DK, title: 'B.3 Experiment: point Kong at the wrong port',
      body: [
        { t: 'file', path: 'kong.yml' },
        { t: 'p', html: 'Change Account Service’s <code>url</code> to a port nobody listens on:' },
        { t: 'code', label: 'Edit (account-service → url)', text: '    url: http://account-service:9999' },
        { t: 'code', label: 'Restart Kong and test', text: `docker compose restart kong
curl -i http://localhost:8000/accounts/100001` },
        { t: 'expected', html: '<strong>502 Bad Gateway</strong>: <code>"An invalid response was received from the upstream server"</code>.' },
        { t: 'trainer', title: 'Teach the status codes', html: '<strong>404 from Kong</strong> = no route matched. <strong>502</strong> = route matched, but the backend couldn’t be reached. <strong>404 from the service</strong> = reached the backend, but it has no such path. Knowing which one you got tells you where to look.' },
        { t: 'p', html: resetNote('kong.yml') + ' Then:' },
        { t: 'code', label: 'Restore', text: 'docker compose restart kong' },
      ]
    },
    {
      part: DK, title: 'B.4 Check questions: Kong',
      body: [
        { t: 'quiz', items: [
          { q: 'Why does <code>kong.yml</code> use port 8080 and not 5101?', a: 'Kong runs inside the Compose network and talks to the container directly on its container port. 5101 is only for traffic from the laptop.' },
          { q: 'What does <code>strip_path: true</code> do to <code>/accounts/100001</code>?', a: 'It removes the matched prefix, so Account Service receives <code>/100001</code>.' },
          { q: 'You edited <code>kong.yml</code> but nothing changed. Why?', a: 'In DB-less mode Kong loads the file at start-up. Run <code>docker compose restart kong</code>.' },
          { q: 'Kong returns 502. Is the route wrong or the backend?', a: 'The route matched (otherwise 404 “no Route matched”). Kong could not reach or get a valid reply from the backend: check the URL, port, or whether the service is running.' },
          { q: 'What does <code>KONG_DATABASE: "off"</code> mean?', a: 'DB-less mode: no Postgres. Routes and services come from the declarative YAML file.' },
          { q: 'How could you add a new <code>/customers</code> API?', a: 'Add another entry under <code>services:</code> with its internal URL and a route with <code>paths: [/customers]</code>, then restart Kong.' },
        ]},
      ]
    },

    // ═════════════ C — KAFKA ═════════════
    {
      part: DF, title: 'C.0 Read the Kafka configuration line by line',
      body: [
        { t: 'annotated', label: 'docker-compose.yml → kafka', text: CODE.kafkaService, notes: kafkaNotes },
        { t: 'diagram', text:
`  Transfer Service                         Kafka broker
        |  1. connect to bootstrap  ---->   kafka:9092   (KAFKA_LISTENERS)
        |  2. "where is the leader?"
        |  <---- 3. "use kafka:9092"        (KAFKA_ADVERTISED_LISTENERS)
        |  4. produce to kafka:9092 ---->   topic bank-transfers, partition 0` },
        { t: 'trainer', html: 'The client uses the bootstrap address only for the first contact. After that it uses whatever Kafka <strong>advertises</strong>. That is why the advertised listener must be an address the <em>client</em> can reach.' },
      ]
    },
    {
      part: DF, title: 'C.1 Inspect topics and messages',
      body: [
        { t: 'p', html: 'Kafka ships with command-line tools inside its container (<code>/opt/kafka/bin</code>).' },
        { t: 'code', label: 'List topics', text: 'docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list' },
        { t: 'expected', html: '<code>bank-transfers</code> (auto-created on the first transfer) and <code>__consumer_offsets</code> (Kafka’s internal store of consumer-group progress).' },
        { t: 'code', label: 'Describe our topic', text: 'docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --describe --topic bank-transfers' },
        { t: 'expected', html: '<code>PartitionCount: 1  ReplicationFactor: 1  Leader: 1</code>: one partition, one copy, on node 1.' },
        { t: 'code', label: 'Read every stored event from the beginning (Ctrl+C to stop)', text: 'docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic bank-transfers --from-beginning' },
        { t: 'expected', html: 'Every transfer event sent so far, as JSON. Press <code>Ctrl+C</code>, and it prints “Processed a total of N messages”.' },
        { t: 'trainer', title: 'Key point', html: 'Reading did <strong>not</strong> remove the messages. Kafka keeps events for the retention period (default 7 days), and each consumer group tracks its own position. A new reader can replay history, unlike a traditional queue.' },
      ]
    },
    {
      part: DF, title: 'C.2 Experiment: consumer lag (offsets)',
      body: [
        { t: 'code', label: 'Where is the jaiz-notifications group up to?', text: 'docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group jaiz-notifications' },
        { t: 'p', html: 'Read the columns: <code>CURRENT-OFFSET</code> = how far the group has read. <code>LOG-END-OFFSET</code> = how many messages exist. <code>LAG</code> = the difference (unread).' },
        { t: 'code', label: 'Stop the consumer and send 3 transfers', text: `docker compose stop notification-service
${transfer}
${transfer}
${transfer}` },
        { t: 'code', label: 'Describe the group again', text: 'docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group jaiz-notifications' },
        { t: 'expected', html: '<code>LOG-END-OFFSET</code> went up by 3 and <strong>LAG = 3</strong>. The events are waiting in Kafka. (The old consumer may still be listed for up to 45 s, because it was stopped without saying goodbye.)' },
        { t: 'code', label: 'Start the consumer and follow its log (Ctrl+C to stop following)', text: `docker compose start notification-service
docker compose logs -f notification-service` },
        { t: 'warn', title: 'Wait about 45 seconds', html: 'The three events arrive roughly <strong>45 s</strong> after the start. Kafka first waits for the old, stopped consumer’s session to time out (<code>session.timeout.ms</code> = 45 s) before handing the partition to the new one. Use the wait to explain sessions and rebalancing.' },
        { t: 'code', label: 'Then check the group again', text: 'docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group jaiz-notifications' },
        { t: 'expected', html: 'Three <code>NOTIFICATION: Transfer event received</code> lines, and <strong>LAG back to 0</strong>.' },
        { t: 'trainer', title: 'Why', html: 'Kafka stored the committed offset for group <code>jaiz-notifications</code>. On restart the consumer resumed from there, so nothing was lost. <code>AutoOffsetReset.Earliest</code> was <em>not</em> used, because the group already had an offset.' },
      ]
    },
    {
      part: DF, title: 'C.3 Experiment: advertise the wrong address',
      body: [
        { t: 'p', html: '<strong>Ask:</strong> <em>“Clients connect to <code>kafka:9092</code>. What if Kafka tells them to use <code>localhost:9092</code>?”</em>' },
        { t: 'file', path: 'docker-compose.yml' },
        { t: 'p', html: 'Under <code>kafka → environment</code>, change the advertised listener to:' },
        { t: 'code', label: 'Edit (kafka → environment)', text: '      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092' },
        { t: 'code', label: 'Recreate Kafka, wait ~20 s, then send a transfer (gives up after 20 s)', text: `docker compose up -d kafka
curl -i -m 20 -X POST http://localhost:8000/transfers/ \\
  ${T}` },
        { t: 'expected', html: 'The request <strong>hangs</strong>, and curl gives up after 20 s with no response. Then run <code>docker compose logs --tail 5 transfer-service</code>. It shows <code>localhost:9092/1: Connect to ipv4#127.0.0.1:9092 failed: Connection refused</code>. Notification Service logs the same error.' },
        { t: 'trainer', title: 'Why', html: 'The client bootstrapped on <code>kafka:9092</code>, then Kafka said “the leader is at <code>localhost:9092</code>”. Inside the Transfer container, localhost is the Transfer container, and no Kafka runs there. The same <code>localhost</code> lesson as A.3, one level deeper.' },
        { t: 'p', html: resetNote('docker-compose.yml') + ' Then recreate Kafka and restart its clients:' },
        { t: 'code', label: 'Restore', text: `docker compose up -d kafka
docker compose restart transfer-service notification-service` },
        { t: 'warn', html: 'Recreating the Kafka container discards its stored messages (this lab has no Kafka volume). The topic is auto-created again on the next transfer.' },
      ]
    },
    {
      part: DF, title: 'C.4 Check questions: Kafka',
      body: [
        { t: 'quiz', items: [
          { q: 'What is the difference between <code>KAFKA_LISTENERS</code> and <code>KAFKA_ADVERTISED_LISTENERS</code>?', a: 'Listeners = where Kafka accepts connections. Advertised = the address Kafka tells clients to use afterwards. The advertised one must be reachable from the client.' },
          { q: 'Why are the replication factors set to 1?', a: 'There is only one broker. You cannot store more copies than you have brokers. Production uses 3.' },
          { q: 'Notification Service was down while 3 transfers were sent. What happens when it starts?', a: 'It resumes from its group’s committed offset and processes the 3 waiting events (LAG goes 3 → 0).' },
          { q: 'Does reading a message delete it from Kafka?', a: 'No. Messages stay until retention expires. Each consumer group tracks its own offset, so a new group can replay from the beginning.' },
          { q: 'What does KRaft mode replace?', a: 'ZooKeeper. Kafka now manages its own metadata with a built-in controller quorum.' },
          { q: 'Name two things you would change before using this Kafka for real banking traffic.', a: 'Any two of: TLS/SASL instead of PLAINTEXT; 3+ brokers with replication factor 3 and min ISR 2; explicitly created topics (auto-create off); persistent volumes; separate controller nodes; monitoring.' },
        ]},
      ]
    },
  ];

  const at = window.LAB_STEPS.findIndex(s => s.part.startsWith('Part 12'));
  window.LAB_STEPS.splice(at, 0, ...steps);
})();
