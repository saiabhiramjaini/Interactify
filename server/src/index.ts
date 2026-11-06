import express from 'express'
import http from 'http'
import cors from 'cors'
import mongoose from 'mongoose'
import { config } from './config'
import { createWebSocketServer } from './ws'
import connectDB from './db/connect'
import { setWriter } from './db/writer'
import { connectRedis } from './redis'
import { pubSubService } from './redis/pubSubService'

const app = express()
const server = http.createServer(app)
const wss = createWebSocketServer()

const isOriginAllowed = (origin: string | undefined): boolean =>
  config.allowedOrigins.length === 0 || (!!origin && config.allowedOrigins.includes(origin))

// Handle HTTP to WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  if (!isOriginAllowed(request.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

// Express middleware
app.use(express.json())
app.use(cors({
  origin: config.allowedOrigins.length ? config.allowedOrigins : 'http://localhost:3000',
  credentials: true,
}))

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    serverId: config.serverId,
    port: config.port,
    kafka: config.enableKafka,
  })
})

let stopKafka: (() => Promise<void>) | undefined

// Connect every dependency before accepting connections
async function initializeServices() {
  await connectDB()
  await connectRedis()
  await pubSubService.initializeSubscriber()

  if (config.enableKafka) {
    // Loaded lazily so kafkajs stays out of memory when Kafka is disabled
    const { startKafka } = await import('./kafka')
    const kafka = await startKafka()
    setWriter(kafka.writer)
    stopKafka = kafka.stop
  }
}

initializeServices()
  .then(() => {
    server.listen(config.port, () => {
      console.log(`🚀 Server ${config.serverId} running on port ${config.port} (Kafka ${config.enableKafka ? 'enabled' : 'disabled'})`)
    })
  })
  .catch((error) => {
    console.error('Error initializing services:', error)
    process.exit(1)
  })

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received. Shutting down gracefully...`)

  try {
    wss.clients.forEach((client) => client.close(1001, 'Server shutting down'))
    wss.close()
    server.close()
    if (stopKafka) await stopKafka()
    pubSubService.disconnect()
    await mongoose.disconnect()
  } catch (error) {
    console.error('Error during shutdown:', error)
  }
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
