import { WebSocketServer } from "ws";
import { websocketService } from './services/websocketService'
import { pubSubService } from '../redis/pubSubService'
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
import { sessionService } from './services/sessionService';

export const createWebSocketServer = () => {
  const wss = new WebSocketServer({ noServer: true });

  // Initialize Redis subscriber when server starts
  pubSubService.initializeSubscriber();

  wss.on("connection", (socket) => {
    websocketService.addClient(socket)

    socket.on("error", (error) => {
      console.error("WebSocket error:", error)
    })

    socket.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString())

        switch (parsedMessage.type) {
          case "create":
            await handleCreateSession(socket, parsedMessage.payload)
            break
          case "join":
            await handleJoinSession(socket, parsedMessage.payload)
            break
          case "getSession":
            await handleGetSession(socket, parsedMessage.payload)
            break
          case "question":
            await handleQuestion(socket, parsedMessage.payload)
            break
          case "vote":
            await handleVote(socket, parsedMessage.payload)
            break
          case "markQuestion":
            await handleMarkQuestion(socket, parsedMessage.payload)
            break
          case "leave":
            await handleLeaveSession(socket, parsedMessage.payload)
            break
          case "close":
            await handleCloseSession(socket, parsedMessage.payload)
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

    socket.on("close", async () => {
      const client = websocketService.removeClient(socket)
      
      if (client && client.roomId && client.attendee) {
        try {
          const session = await sessionService.leaveSession(client.roomId, client.attendee.id)
          
          if (session) {
            websocketService.broadcastToRoom(client.roomId, {
              type: "attendeeLeft",
              payload: { attendee: client.attendee, attendees: session.attendees },
            })
          }
        } catch (error) {
          console.error("Error handling client disconnect:", error)
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