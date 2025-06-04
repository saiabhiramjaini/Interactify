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
- Moderate questions as needed

**For Attendees:**
- Join sessions via room code or shared link
- Submit questions anonymously or with identification
- Upvote/downvote other participants' questions
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
- **Kafka** (High-volume data processing)

### Database
- **MongoDB Atlas** (Cloud database service)
- **Mongoose** (ODM for MongoDB)

### Infrastructure
- **Docker** (Containerization)
- **Docker Hub** (Image repository)
- **AWS EC2** (Cloud hosting)
- **GitHub Actions** (CI/CD pipelines)

## Architecture

![Image](https://github.com/user-attachments/assets/0d9a7a63-4dd8-4245-8136-06e0b011a96a)


1. **Client-Server Communication**: WebSocket connections for real-time updates
2. **Redis Pub/Sub**: Handles message broadcasting across multiple server instances
3. **Kafka**: Processes high volumes of interaction data
4. **MongoDB**: Persistent storage for sessions and questions

![Image](https://github.com/user-attachments/assets/2a6d5681-cae3-48db-93a3-aea68e6be29f)

## Deployment 

![Image](https://github.com/user-attachments/assets/15969064-a942-4a55-b123-381616105984)

## Setup & Installation

### Prerequisites
- Node.js (v18+)
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
     PRIVATE_IP="localhost"
     ```
   - Example `.env` for client:
     ```ini
     NEXT_PUBLIC_WS_URL=ws://localhost:8080
     ```

3. **Start infrastructure services** (using Docker Compose recommended):
   ```bash
   cd server
   docker-compose up -d
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
**NOTE: If you are running individual docker containers then you need to change the PRIVATE_IP in .env with your system's IP which you can get by running ifconfig for mac (IP under en0) or ipconfig for windows**

## Deployment

### CI/CD Pipeline
The project uses GitHub Actions for continuous integration and deployment:
1. **Build Stage** (`build.yaml`):
   - Runs on push to main branch
   - Installs dependencies
   - Runs type checking and tests
   - Builds the application

2. **Deploy Stage** (`deploy.yaml`):
   - Executes only if build succeeds
   - SSH into AWS EC2 instance
   - Builds and pushes Docker images
   - Pulls images from Docker Hub
   - Deploys to production

### Manual Deployment Steps
1. **Frontend** (Vercel):
   ```bash
   cd client
   vercel deploy
   ```

2. **Backend** (AWS EC2):
   ```bash
   # On your EC2 instance
   docker-compose -f production-compose.yml up -d
   ```

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
- Kafka processing high volumes of interaction data

## Contributing

We welcome contributions! Please follow these steps:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request



**GitHub Repository**: [https://github.com/saiabhiramjaini/Interactify](https://github.com/saiabhiramjaini/Interactify)