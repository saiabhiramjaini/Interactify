import { WebSocket } from "ws"
import { ClientConnection, Attendee } from '../../types'
import { pubSubService } from '../../redis/pubSubService'

class WebSocketService {
  private clients: ClientConnection[] = []

  addClient(socket: WebSocket): void {
    const clientConnection: ClientConnection = { socket }
    this.clients.push(clientConnection)
  }

  removeClient(socket: WebSocket): ClientConnection | null {
    const index = this.clients.findIndex((c) => c.socket === socket)
    if (index === -1) return null

    const client = this.clients[index]
    this.clients.splice(index, 1)
    return client
  }

  updateClientRoom(socket: WebSocket, roomId: string, attendee: Attendee): void {
    const client = this.clients.find((c) => c.socket === socket)
    if (client) {
      client.roomId = roomId
      client.attendee = attendee
    }
  }

  clearClientRoom(socket: WebSocket): void {
    const client = this.clients.find((c) => c.socket === socket)
    if (client) {
      client.roomId = undefined
      client.attendee = undefined
    }
  }

  clearClientsFromRoom(roomId: string): void {
    this.clients.forEach((client) => {
      if (client.roomId === roomId) {
        client.roomId = undefined
        client.attendee = undefined
      }
    })
  }

  // UPDATED: Added skipRedis parameter to avoid infinite loops
  broadcastToRoom(roomId: string, message: any, excludeSocket?: WebSocket, skipRedis: boolean = false): void {
    // Send to local clients
    this.clients.forEach((client) => {
      if (
        client.roomId === roomId &&
        client.socket !== excludeSocket &&
        client.socket.readyState === WebSocket.OPEN
      ) {
        client.socket.send(JSON.stringify(message))
      }
    })

    // If this is not from Redis (skipRedis = false), also publish to Redis
    // so other servers can send to their clients
    if (!skipRedis) {
      pubSubService.publishToRoom(roomId, message)
    }
  }

  sendToClient(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  getClients(): ClientConnection[] {
    return this.clients
  }

  getClientBySocket(socket: WebSocket): ClientConnection | undefined {
    return this.clients.find((c) => c.socket === socket)
  }
}

export const websocketService = new WebSocketService()