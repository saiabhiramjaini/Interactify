import { WebSocket } from "ws"
import { sessionService } from '../services/sessionService'
import { websocketService } from '../services/websocketService'
import { generateRoomId } from '../utils/generateRoomId'

export const handleCreateSession = (socket: WebSocket, payload: any): void => {
  try {
    const { sessionName, owner } = payload
    const roomId = generateRoomId()

    const newSession = sessionService.createSession(sessionName, owner, roomId)

    websocketService.sendToClient(socket, {
      type: "sessionCreated",
      payload: { roomId, sessionName, owner },
    })
  } catch (error) {
    console.error("Error creating session:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error creating session" },
    })
  }
}

export const handleJoinSession = (socket: WebSocket, payload: any): void => {
  try {
    const { roomId, attendee } = payload
    const session = sessionService.joinSession(roomId, attendee)

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found" },
      })
      return
    }

    websocketService.updateClientRoom(socket, roomId, attendee)

    websocketService.sendToClient(socket, {
      type: "sessionJoined",
      payload: {
        sessionName: session.sessionName,
        owner: session.owner,
        attendees: session.attendees,
        questions: session.questions,
      },
    })

    websocketService.broadcastToRoom(roomId, {
      type: "attendeeJoined",
      payload: { attendee, attendees: session.attendees },
    }, socket)
  } catch (error) {
    console.error("Error joining session:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error joining session" },
    })
  }
}

export const handleGetSession = (socket: WebSocket, payload: any): void => {
  try {
    const { roomId } = payload
    const session = sessionService.findSession(roomId)

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found" },
      })
      return
    }

    websocketService.sendToClient(socket, {
      type: "sessionData",
      payload: {
        sessionName: session.sessionName,
        owner: session.owner,
        attendees: session.attendees,
        questions: session.questions,
      },
    })
  } catch (error) {
    console.error("Error getting session:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error getting session data" },
    })
  }
}

export const handleQuestion = (socket: WebSocket, payload: any): void => {
  try {
    const { roomId, questionText, author } = payload
    const question = sessionService.addQuestion(roomId, questionText, author)

    if (!question) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found or you must join the session to ask a question" },
      })
      return
    }

    websocketService.broadcastToRoom(roomId, {
      type: "question",
      payload: question,
    })
  } catch (error) {
    console.error("Error adding question:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error adding question" },
    })
  }
}

export const handleVote = (socket: WebSocket, payload: any): void => {
  try {
    const { roomId, questionText, voteType } = payload
    
    if (voteType !== 'upVote' && voteType !== 'downVote') {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Invalid vote type" },
      })
      return
    }

    const question = sessionService.voteQuestion(roomId, questionText, voteType)

    if (!question) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session or question not found" },
      })
      return
    }

    websocketService.broadcastToRoom(roomId, {
      type: "vote",
      payload: {
        questionText,
        upVotes: question.upVotes,
        downVotes: question.downVotes,
      },
    })
  } catch (error) {
    console.error("Error voting:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error voting" },
    })
  }
}

export const handleMarkQuestion = (socket: WebSocket, payload: any): void => {
  try {
    const { roomId, questionText, action } = payload
    const question = sessionService.markQuestion(roomId, questionText, action)

    if (!question) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found, question not found, or invalid action" },
      })
      return
    }

    const updatePayload: any = { questionText }

    if (action === "answered" || action === "unanswered") {
      updatePayload.answered = question.answered
    } else if (action === "highlighted" || action === "unhighlighted") {
      updatePayload.highlighted = question.highlighted
    }

    websocketService.broadcastToRoom(roomId, {
      type: "markQuestion",
      payload: updatePayload,
    })
  } catch (error) {
    console.error("Error marking question:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error marking question" },
    })
  }
}

export const handleLeaveSession = (socket: WebSocket, payload: any): void => {
  try {
    const { roomId, attendee } = payload
    const session = sessionService.leaveSession(roomId, attendee)

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found" },
      })
      return
    }

    websocketService.clearClientRoom(socket)

    websocketService.broadcastToRoom(roomId, {
      type: "attendeeLeft",
      payload: { attendee, attendees: session.attendees },
    }, socket)
  } catch (error) {
    console.error("Error leaving session:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error leaving session" },
    })
  }
}

export const handleCloseSession = (socket: WebSocket, payload: any): void => {
  try {
    const { roomId, owner } = payload
    const success = sessionService.closeSession(roomId, owner)

    if (!success) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found or only the owner can close the session" },
      })
      return
    }

    websocketService.broadcastToRoom(roomId, {
      type: "sessionClosed",
      payload: { roomId },
    })

    websocketService.clearClientsFromRoom(roomId)
  } catch (error) {
    console.error("Error closing session:", error)
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error closing session" },
    })
  }
}