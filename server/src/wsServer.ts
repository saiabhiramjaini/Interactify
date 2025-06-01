import { WebSocketServer } from "ws";
import { websocketService } from './services/websocketService'
import { pubSubService } from './redis/pubSubService' // NEW IMPORT
import {
  handleCreateSession,
  handleJoinSession,
  handleGetSession,
  handleQuestion,
  handleVote,
  handleMarkQuestion,
  handleLeaveSession,
  handleCloseSession,
} from './handlers/messageHandlers'

export const createWebSocketServer = () => {
  const wss = new WebSocketServer({ noServer: true });

  // Initialize Redis subscriber when server starts
  pubSubService.initializeSubscriber(); // NEW LINE

  wss.on("connection", (socket) => {
    websocketService.addClient(socket)

    socket.on("error", (error) => {
      console.error("WebSocket error:", error)
    })

    socket.on("message", (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString())

        switch (parsedMessage.type) {
          case "create":
            handleCreateSession(socket, parsedMessage.payload)
            break
          case "join":
            handleJoinSession(socket, parsedMessage.payload)
            break
          case "getSession":
            handleGetSession(socket, parsedMessage.payload)
            break
          case "question":
            handleQuestion(socket, parsedMessage.payload)
            break
          case "vote":
            handleVote(socket, parsedMessage.payload)
            break
          case "markQuestion":
            handleMarkQuestion(socket, parsedMessage.payload)
            break
          case "leave":
            handleLeaveSession(socket, parsedMessage.payload)
            break
          case "close":
            handleCloseSession(socket, parsedMessage.payload)
            break
          default:
            console.error("Unknown message type:", parsedMessage.type)
            websocketService.sendToClient(socket, {
              type: "error",
              payload: { message: "Unknown message type" },
            })
        }
      } catch (error) {
        console.error("Error parsing message:", error)
        websocketService.sendToClient(socket, {
          type: "error",
          payload: { message: "Invalid message format" },
        })
      }
    })

    socket.on("close", () => {
      const client = websocketService.removeClient(socket)
      
      if (client && client.roomId && client.attendee) {
        const { sessionService } = require('./services/sessionService')
        const session = sessionService.leaveSession(client.roomId, client.attendee)
        
        if (session) {
          websocketService.broadcastToRoom(client.roomId, {
            type: "attendeeLeft",
            payload: { attendee: client.attendee, attendees: session.attendees },
          })
        }
      }
    })
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down...')
    pubSubService.disconnect()
    wss.close()
  })

  return wss
}