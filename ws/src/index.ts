import { WebSocketServer, WebSocket } from "ws"

interface Session {
  sessionName: string
  roomId: string
  owner: string
  attendees: string[]
  questions: Question[]
  createdAt: Date
}

interface Question {
  questionText: string
  upVotes: number
  downVotes: number
  author: string
  createdAt: Date
  answered: boolean
  highlighted: boolean
}

interface ClientConnection {
  socket: WebSocket
  roomId?: string
  attendee?: string
}

let sessions: Session[] = []
let clients: ClientConnection[] = []

const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const wss = new WebSocketServer({ port: 8080 })

// Helper function to broadcast to all clients in a room
const broadcastToRoom = (roomId: string, message: any, excludeSocket?: WebSocket) => {
  clients.forEach((client) => {
    if (client.roomId === roomId && client.socket !== excludeSocket && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message))
    }
  })
}

// Helper function to find session by roomId
const findSession = (roomId: string) => {
  return sessions.find((s) => s.roomId === roomId)
}

wss.on("connection", (socket) => {
  
  // Add client to connections list
  const clientConnection: ClientConnection = { socket }
  clients.push(clientConnection)

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
          socket.send(
            JSON.stringify({
              type: "error",
              payload: { message: "Unknown message type" },
            })
          )
      }
    } catch (error) {
      console.error("Error parsing message:", error)
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Invalid message format" },
        })
      )
    }
  })

  socket.on("close", () => {
    // Remove client from connections list
    const index = clients.findIndex((c) => c.socket === socket)
    if (index !== -1) {
      const client = clients[index]
      clients.splice(index, 1)
      
      // If client was in a session, remove them from attendees
      if (client.roomId && client.attendee) {
        const session = findSession(client.roomId)
        if (session) {
          session.attendees = session.attendees.filter((a) => a !== client.attendee)
          // Broadcast attendee left
          broadcastToRoom(client.roomId, {
            type: "attendeeLeft",
            payload: { attendee: client.attendee, attendees: session.attendees },
          })
        }
      }
    }
  })
})

console.log("WebSocket server is running on ws://localhost:8080")

const handleCreateSession = (socket: WebSocket, payload: any) => {
  try {
    const { sessionName, owner } = payload
    const roomId = generateRoomId()

    const newSession: Session = {
      sessionName,
      roomId,
      owner,
      attendees: [],
      questions: [],
      createdAt: new Date(),
    }

    sessions.push(newSession)

    socket.send(
      JSON.stringify({
        type: "sessionCreated",
        payload: { roomId, sessionName, owner },
      })
    )
  } catch (error) {
    console.error("Error creating session:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error creating session" },
      })
    )
  }
}

const handleJoinSession = (socket: WebSocket, payload: any) => {
  try {
    const { roomId, attendee } = payload
    const session = findSession(roomId)

    if (!session) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
    }

    // Update client connection info
    const clientConnection = clients.find((c) => c.socket === socket)
    if (clientConnection) {
      clientConnection.roomId = roomId
      clientConnection.attendee = attendee
    }

    if (!session.attendees.includes(attendee)) {
      session.attendees.push(attendee)
    }

    // Send session data to the joining client
    socket.send(
      JSON.stringify({
        type: "sessionJoined",
        payload: {
          sessionName: session.sessionName,
          owner: session.owner,
          attendees: session.attendees,
          questions: session.questions,
        },
      })
    )

    // Broadcast to other clients in the room that someone joined
    broadcastToRoom(roomId, {
      type: "attendeeJoined",
      payload: { attendee, attendees: session.attendees },
    }, socket)
  } catch (error) {
    console.error("Error joining session:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error joining session" },
      })
    )
  }
}

const handleGetSession = (socket: WebSocket, payload: any) => {
  try {
    const { roomId } = payload
    const session = findSession(roomId)

    if (!session) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
    }

    socket.send(
      JSON.stringify({
        type: "sessionData",
        payload: {
          sessionName: session.sessionName,
          owner: session.owner,
          attendees: session.attendees,
          questions: session.questions,
        },
      })
    )
  } catch (error) {
    console.error("Error getting session:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error getting session data" },
      })
    )
  }
}

const handleQuestion = (socket: WebSocket, payload: any) => {
  try {
    const { roomId, questionText, author } = payload
    const session = findSession(roomId)

    if (!session) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
    }

    if (!session.attendees.includes(author)) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "You must join the session to ask a question" },
        })
      )
      return
    }

    const newQuestion: Question = {
      questionText,
      upVotes: 0,
      downVotes: 0,
      author,
      createdAt: new Date(),
      answered: false,
      highlighted: false,
    }

    session.questions.push(newQuestion)

    // Broadcast new question to all clients in the room
    broadcastToRoom(roomId, {
      type: "question",
      payload: newQuestion,
    })
  } catch (error) {
    console.error("Error adding question:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error adding question" },
      })
    )
  }
}

const handleVote = (socket: WebSocket, payload: any) => {
  try {
    const { roomId, questionText, voteType } = payload
    const session = findSession(roomId)

    if (!session) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
    }

    const question = session.questions.find((q) => q.questionText === questionText)

    if (!question) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Question not found" },
        })
      )
      return
    }

    if (voteType === "upVote") {
      question.upVotes += 1
    } else if (voteType === "downVote") {
      question.downVotes += 1
    } else {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Invalid vote type" },
        })
      )
      return
    }

    // Broadcast vote update to all clients in the room
    broadcastToRoom(roomId, {
      type: "vote",
      payload: {
        questionText,
        upVotes: question.upVotes,
        downVotes: question.downVotes,
      },
    })
  } catch (error) {
    console.error("Error voting:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error voting" },
      })
    )
  }
}

const handleMarkQuestion = (socket: WebSocket, payload: any) => {
  try {
    const { roomId, questionText, action } = payload
    const session = findSession(roomId)

    if (!session) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
    }

    const question = session.questions.find((q) => q.questionText === questionText)

    if (!question) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Question not found" },
        })
      )
      return
    }

    let updatePayload: any = { questionText }

    if (action === "answered") {
      question.answered = true
      updatePayload.answered = true
    } else if (action === "unanswered") {
      question.answered = false
      updatePayload.answered = false
    } else if (action === "highlighted") {
      question.highlighted = true
      updatePayload.highlighted = true
    } else if (action === "unhighlighted") {
      question.highlighted = false
      updatePayload.highlighted = false
    } else {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Invalid action" },
        })
      )
      return
    }

    // Broadcast question update to all clients in the room
    broadcastToRoom(roomId, {
      type: "markQuestion",
      payload: updatePayload,
    })
  } catch (error) {
    console.error("Error marking question:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error marking question" },
      })
    )
  }
}

const handleLeaveSession = (socket: WebSocket, payload: any) => {
  try {
    const { roomId, attendee } = payload
    const session = findSession(roomId)

    if (!session) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
    }

    session.attendees = session.attendees.filter((a) => a !== attendee)

    // Update client connection info
    const clientConnection = clients.find((c) => c.socket === socket)
    if (clientConnection) {
      clientConnection.roomId = undefined
      clientConnection.attendee = undefined
    }

    // Broadcast to other clients in the room
    broadcastToRoom(roomId, {
      type: "attendeeLeft",
      payload: { attendee, attendees: session.attendees },
    }, socket)
  } catch (error) {
    console.error("Error leaving session:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error leaving session" },
      })
    )
  }
}

const handleCloseSession = (socket: WebSocket, payload: any) => {
  try {
    const { roomId, owner } = payload
    const sessionIndex = sessions.findIndex((s) => s.roomId === roomId)

    if (sessionIndex === -1) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
    }

    const session = sessions[sessionIndex]

    if (session.owner !== owner) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Only the owner can close the session" },
        })
      )
      return
    }

    // Broadcast session closure to all clients in the room
    broadcastToRoom(roomId, {
      type: "sessionClosed",
      payload: { roomId },
    })

    sessions.splice(sessionIndex, 1)

    // Remove all clients from this room
    clients.forEach((client) => {
      if (client.roomId === roomId) {
        client.roomId = undefined
        client.attendee = undefined
      }
    })
  } catch (error) {
    console.error("Error closing session:", error)
    socket.send(
      JSON.stringify({
        type: "error",
        payload: { message: "Error closing session" },
      })
    )
  }
}