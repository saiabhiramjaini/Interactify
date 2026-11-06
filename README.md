# Interactify - Real-Time Audience Interaction Platform



## Overview

Interactify solves the challenge of managing audience questions during seminars and presentations by providing a real-time interactive platform where:
- Attendees can submit and vote on questions
- Popular questions rise to the top automatically
- Presenters can easily identify and address the most relevant questions
- All interactions happen in real-time via WebSockets

![Image](https://github.com/user-attachments/assets/29444adb-b775-4e94-85c0-4723f4f5256c)

![Image](https://github.com/user-attachments/assets/72ad788d-944a-4218-bd85-92a2ba9e2938)

## Features

**For Presenters:**
- Create interactive sessions with unique room codes
- View real-time question ranking
- Mark questions answered or highlighted, and end the session
- Presenter controls are tied to the browser that created the session (a secret owner token kept in `localStorage`)

**For Attendees:**
- Join sessions via room code or shared link
- Submit questions under a generated or chosen display name
- Upvote questions (click again to remove your vote)
- See question rankings update in real-time

## Tech Stack

### Frontend
- **Next.js** (React framework)
- **TailwindCSS** (Utility-first CSS)
- **ShadCN UI** (Beautifully designed components)
- **TypeScript** (Type-safe JavaScript)

### Backend
- **Node.js** (Runtime environment)
- **WebSockets** (Real-time communication)
- **Redis** (Pub/Sub pattern for scalability)
- **Kafka** (Optional write pipeline, enabled with `ENABLE_KAFKA=true`)

### Database
- **MongoDB Atlas** (Cloud database service)
- **Mongoose** (ODM for MongoDB)

### Infrastructure
- **Android phone + Termux** (Server host: a Samsung Galaxy J6)
- **PM2** (Keeps the server and tunnel running)
- **Cloudflare Tunnel + Access** (Public URL for the server, and authenticated SSH for deploys)
- **Vercel** (Client hosting)
- **GitHub Actions** (CI/CD pipelines)
- **Docker** (Local Redis/Kafka, and an optional container image for the server)

## Architecture

![Image](https://github.com/user-attachments/assets/0d9a7a63-4dd8-4245-8136-06e0b011a96a)

![Image](https://github.com/user-attachments/assets/2bea3a24-a8b2-4c06-bbb9-a3f18cf6f310)


1. **Client-Server Communication**: WebSocket connections for real-time updates
2. **Redis Pub/Sub**: Handles message broadcasting across multiple server instances
3. **Kafka (optional)**: When enabled, session writes are produced to the `db-operations` topic (keyed by room so each room's writes stay in order), applied by a consumer, and acknowledged back over Redis before the server replies
4. **MongoDB**: Persistent storage for sessions and questions

The diagrams above show the full design with Kafka. In production Kafka is turned off, and writes go straight from the server to MongoDB:

```mermaid
flowchart LR
    user([User]) -- website --> client["Client<br/>Next.js on Vercel"]
    client -- "wss://" --> cf["Cloudflare Tunnel"]

    subgraph phone["Samsung Galaxy J6 · Termux"]
        cfd["cloudflared<br/>(PM2)"] --> server["WebSocket server<br/>Node.js + Express<br/>(PM2, port 8080)"]
        server <--> redis[("Redis<br/>pub/sub")]
    end

    cf --> cfd
    server -- Mongoose --> mongo[("MongoDB Atlas")]
```


## Setup & Installation

### Prerequisites
- Node.js (v20+; CI uses v24)
- Docker
- Docker Compose
- MongoDB Atlas account

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/saiabhiramjaini/Interactify.git
   cd Interactify
   ```

2. **Set up environment variables**:
   - Create `.env` files in both `client/` and `server/` directories
   - Example `.env` for server:
     ```ini
     PORT=8080
     REDIS_HOST="localhost"
     REDIS_PORT=6379
     MONGO_URI="your_mongodb_atlas_connection_string"

     # Optional
     SERVER_ID="server-1"                     # Shown in /health and logs
     ALLOWED_ORIGINS="http://localhost:3000"  # Comma-separated; unset = accept WebSockets from any origin
     ENABLE_KAFKA=false                       # true routes writes through Kafka
     KAFKA_BROKERS="localhost:9092"           # Defaults to $PRIVATE_IP:9092, then localhost:9092
     ```
   - Example `.env` for client:
     ```ini
     NEXT_PUBLIC_WS_URL=ws://localhost:8080
     ```

3. **Start infrastructure services** (using Docker Compose recommended):
   ```bash
   cd server
   docker compose up -d                    # Redis only
   docker compose --profile kafka up -d    # Redis, Zookeeper and Kafka (for ENABLE_KAFKA=true)
   ```

4. **Install dependencies and start servers**:
   ```bash
   # In one terminal (server)
   cd server
   npm install
   npm start

   # In another terminal (client)
   cd client
   npm install
   npm run dev
   ```

### Alternative: Individual Docker Containers
If not using Docker Compose, you can start services individually:
```bash
# Redis
docker run -d --name redis-stack -p 6379:6379 -p 8001:8001 redis/redis-stack:latest

# Zookeeper
docker run -d --name zookeeper -p 2181:2181 zookeeper

# Kafka (replace IP with your private IP from ifconfig)
docker run -d --name kafka -p 9092:9092 \
  -e KAFKA_HEAP_OPTS="-Xmx512m -Xms512m" \
  -e KAFKA_ZOOKEEPER_CONNECT=your_private_ip:2181 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://your_private_ip:9092 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  confluentinc/cp-kafka
```
**NOTE: If you are running individual docker containers then you need to set PRIVATE_IP (or KAFKA_BROKERS) in .env to your system's IP, which you can get by running ifconfig for mac (IP under en0) or ipconfig for windows**

### Running Tests
```bash
cd server
npm test
```
The tests run against an in-memory MongoDB (downloaded on first run), so no external services are needed.

## Deployment

The server runs on an old Samsung Galaxy J6 in Termux. PM2 keeps it running, and a Cloudflare Tunnel exposes it to the internet, so the phone needs no public IP or open ports. The client is hosted on Vercel.

### CI/CD Pipeline

GitHub Actions runs two workflows:

1. **Build and Test** (`build.yaml`)
   - Runs on pull requests to `main` and on pushes to `main`
   - Builds and tests the server
   - Builds (and type-checks) the client

2. **Deploy server to phone** (`deploy.yaml`)
   - Runs on pushes to `main` that touch `server/` or `deploy/`, or manually from the Actions tab
   - Builds and tests the server again; nothing reaches the phone unless the tests pass
   - Packages the compiled `dist/` and copies it to the phone over SSH, through the Cloudflare tunnel (authenticated by a Cloudflare Access service token)
   - Runs [`deploy/deploy.sh`](deploy/deploy.sh) on the phone, which:
     - fast-forwards the repo on the phone to the deployed commit
     - installs production dependencies only
     - swaps in the new build and restarts the server with PM2
     - waits for `/health`, and restores the previous build if it doesn't become healthy within 30 seconds

```mermaid
flowchart TD
    push["Push to main"] --> build["build.yaml<br/>build + test server and client"]
    push -- "server/ or deploy/ changed" --> ci["deploy.yaml<br/>npm ci → build → test"]
    ci -- "tests fail" --> stop(["Deploy stops"])
    ci -- "tests pass" --> pkg["Package server/dist"]
    pkg -- "scp + ssh via<br/>Cloudflare tunnel" --> sh

    subgraph phone["Phone (Termux)"]
        sh["deploy/deploy.sh"] --> git["git fast-forward"]
        git --> deps["npm ci --omit=dev"]
        deps --> restart["Unpack dist, pm2 restart"]
        restart --> health{"/health OK<br/>within 30s?"}
        health -- yes --> save(["pm2 save · deployed"])
        health -- no --> rollback(["Restore previous build"])
    end
```

The phone never builds anything: its 32-bit Android userspace can't install the build and test tooling, and building in CI means the phone runs exactly what passed the tests.

See [`deploy/README.md`](deploy/README.md) for the one-time setup: phone packages, the Cloudflare tunnel and Access policy, the deploy key, GitHub secrets, and starting everything on boot with Termux:Boot.

### Kafka Is Optional

There is a single server in `server/`. Kafka is off by default (`ENABLE_KAFKA=false`), which is how it runs on the phone:

- Writes go straight to MongoDB, and kafkajs is never loaded, keeping memory use low
- WebSocket communication and Redis pub/sub work exactly as with Kafka enabled
- Set `ENABLE_KAFKA=true` (and run Zookeeper and Kafka) to route writes through Kafka instead

### Other Hosts

The server's `Dockerfile` still builds a production image for any container host. It listens on port 8000 inside the container unless you pass `-e PORT=...`.


## Scaling Test

To verify the system's scalability:
```bash
# Terminal 1 - Server 1
PORT=8080 SERVER_ID=server-1 npm start

# Terminal 2 - Server 2
PORT=8081 SERVER_ID=server-2 npm start

# Terminal 3 - Client 1
NEXT_PUBLIC_WS_URL=ws://localhost:8080 npm run dev

# Terminal 4 - Client 2
NEXT_PUBLIC_WS_URL=ws://localhost:8081 PORT=3001 npm run dev
```

![Image](https://github.com/user-attachments/assets/dc3ae248-0ac2-425f-a010-2e4a07583c32)

This setup demonstrates:
- Multiple server instances handling different client connections
- Redis Pub/Sub ensuring synchronized state across servers
- (With `ENABLE_KAFKA=true`) Kafka carrying writes from both servers

## Contributing

We welcome contributions! Please follow these steps:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request



**GitHub Repository**: [https://github.com/saiabhiramjaini/Interactify](https://github.com/saiabhiramjaini/Interactify)
