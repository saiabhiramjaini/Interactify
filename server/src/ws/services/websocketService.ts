import { WebSocket } from "ws"
import { ClientConnection, Attendee, ClientRole } from '../../types'
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

  updateClientRoom(socket: WebSocket, roomId: string, role: ClientRole, attendee?: Attendee): void {
    const client = this.clients.find((c) => c.socket === socket)
    if (client) {
      client.roomId = roomId
      client.role = role
      client.attendee = attendee
    }
  }

  clearClientRoom(socket: WebSocket): void {
    const client = this.clients.find((c) => c.socket === socket)
    if (client) {
      client.roomId = undefined
      client.role = undefined
      client.attendee = undefined
    }
  }

  clearClientsFromRoom(roomId: string): void {
    this.clients.forEach((client) => {
      if (client.roomId === roomId) {
        client.roomId = undefined
        client.role = undefined
        client.attendee = undefined
      }
    })
  }

  // Send to this server's clients in the room and publish to Redis so the
  // other server instances can send it to theirs.
  broadcastToRoom(roomId: string, message: any, excludeSocket?: WebSocket): void {
    this.deliverToRoom(roomId, message, excludeSocket)
    pubSubService.publishToRoom(roomId, message)
  }

  // Send only to this server's clients in the room
  deliverToRoom(roomId: string, message: any, excludeSocket?: WebSocket): void {
    const data = JSON.stringify(message)
    this.clients.forEach((client) => {
      if (
        client.roomId === roomId &&
        client.socket !== excludeSocket &&
        client.socket.readyState === WebSocket.OPEN
      ) {
        client.socket.send(data)
      }
    })
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
