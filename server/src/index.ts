import express from 'express'
import http from 'http'
import { createWebSocketServer } from './wsServer'
import connectDB from './db/connect'

const app = express()
const server = http.createServer(app)

// Create WebSocket server
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
app.use((req, res, next) => {
  // Enable CORS if needed
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

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

connectDB();

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Server ${SERVER_ID} starting...`)
  console.log(`HTTP server is running on http://localhost:${PORT}`)
  console.log(`WebSocket server is running on ws://localhost:${PORT}`)
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error)
  })
})