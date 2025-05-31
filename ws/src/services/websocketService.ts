import { WebSocket } from "ws"
import { ClientConnection } from '../types'

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

  updateClientRoom(socket: WebSocket, roomId: string, attendee: string): void {
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

  broadcastToRoom(roomId: string, message: any, excludeSocket?: WebSocket): void {
    this.clients.forEach((client) => {
      if (
        client.roomId === roomId &&
        client.socket !== excludeSocket &&
        client.socket.readyState === WebSocket.OPEN
      ) {
        client.socket.send(JSON.stringify(message))
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
}

export const websocketService = new WebSocketService()