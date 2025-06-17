import express from 'express'
import http from 'http'
import cors from 'cors'
import { createWebSocketServer } from './ws'
import connectDB from './db/connect'

const app = express()
const server = http.createServer(app)

const wss = createWebSocketServer()

// Handle HTTP to WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  // You can add authentication/validation here if needed
  console.log('Upgrading to WebSocket connection')
  
  wss.handleUpgrade(request, socket, head, (socket) => {
    wss.emit('connection', socket, request)
  })
})

// Express middleware
app.use(express.json())
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}))

// Get port from environment variable or default to 8080
const PORT = process.env.PORT || 8080
const SERVER_ID = process.env.SERVER_ID || 'server-1'

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    websocket: `ws://localhost:${PORT}`,
    serverId: SERVER_ID,
    port: PORT
  })
})

// Initialize services
async function initializeServices() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('MongoDB connected successfully');
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    process.exit(1);
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Server ${SERVER_ID} starting...`)
  console.log(`HTTP server is running on http://localhost:${PORT}`)
  console.log(`WebSocket server is running on ws://localhost:${PORT}`)
  
  initializeServices();
})

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});