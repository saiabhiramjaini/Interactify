import { WebSocketServer, WebSocket, RawData } from "ws";
import { websocketService } from './services/websocketService'
import {
  handleCreateSession,
  handleJoinSession,
  handleGetSession,
  handleQuestion,
  handleVote,
  handleMarkQuestion,
  handleLeaveSession,
  handleCloseSession,
  notifyAttendeeLeft,
} from './handlers/messageHandlers'

const MAX_PAYLOAD_BYTES = 64 * 1024

const handlers: Record<string, (socket: WebSocket, payload: any) => Promise<void>> = {
  create: handleCreateSession,
  join: handleJoinSession,
  getSession: handleGetSession,
  question: handleQuestion,
  vote: handleVote,
  markQuestion: handleMarkQuestion,
  leave: handleLeaveSession,
  close: handleCloseSession,
}

export const handleRawMessage = async (socket: WebSocket, message: RawData | string) => {
  let parsedMessage: any
  try {
    parsedMessage = JSON.parse(message.toString())
  } catch (error) {
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Invalid message format" },
    })
    return
  }

  const handler = handlers[parsedMessage?.type]
  if (!handler) {
    console.error("Unknown message type:", parsedMessage?.type)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Unknown message type" },
    })
    return
  }

  await handler(socket, parsedMessage.payload)
}

export const handleSocketClosed = async (socket: WebSocket) => {
  const client = websocketService.removeClient(socket)

  if (client?.roomId && client.role === 'attendee' && client.attendee) {
    try {
      await notifyAttendeeLeft(client.roomId, client.attendee)
    } catch (error) {
      console.error("Error handling client disconnect:", error)
    }
  }
}

export const createWebSocketServer = () => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

  wss.on("connection", (socket) => {
    websocketService.addClient(socket)

    socket.on("error", (error) => {
      console.error("WebSocket error:", error)
    })

    socket.on("message", (message) => {
      handleRawMessage(socket, message).catch((error) => {
        console.error("Error handling message:", error)
      })
    })

    socket.on("close", () => {
      handleSocketClosed(socket)
    })
  })

  return wss
}
