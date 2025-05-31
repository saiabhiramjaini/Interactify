import { WebSocket } from "ws"

export interface Session {
  sessionName: string
  roomId: string
  owner: string
  attendees: string[]
  questions: Question[]
  createdAt: Date
}

export interface Question {
  questionText: string
  upVotes: number
  downVotes: number
  author: string
  createdAt: Date
  answered: boolean
  highlighted: boolean
}

export interface ClientConnection {
  socket: WebSocket
  roomId?: string
  attendee?: string
}

export interface MessagePayload {
  type: string
  payload: any
}
