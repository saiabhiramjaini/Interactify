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

let sessions: Session[] = []

const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const wss = new WebSocketServer({ port: 8080 })

wss.on("connection", (socket) => {
  console.log("Client connected")

  socket.on("error", (error) => {
    console.error("WebSocket error:", error)
  })

  socket.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString())
      console.log("Received message:", parsedMessage.type)

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
    console.log("Client disconnected")
  })
})

console.log("WebSocket server is running on ws://localhost:8080")

// Broadcast to all clients in a room except the sender
const broadcastToRoom = (roomId: string, message: any, excludeSocket?: WebSocket) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // In a real app, you'd track which client is in which room
      // For simplicity, we'll broadcast to all connected clients
      if (client !== excludeSocket) {
        client.send(JSON.stringify(message))
      }
    }
  })
}

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

    console.log("Session created:", newSession)
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
    const session = sessions.find((s) => s.roomId === roomId)

    if (!session) {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Session not found" },
        })
      )
      return
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

    // Notify other clients about new attendee
    broadcastToRoom(
      roomId,
      {
        type: "attendeeJoined",
        payload: {
          attendee,
          attendees: session.attendees,
        },
      },
      socket
    )

    console.log("Attendee joined:", attendee, "to room:", roomId)
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
    const session = sessions.find((s) => s.roomId === roomId)

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
    const session = sessions.find((s) => s.roomId === roomId)

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

    // Notify all clients in the room
    broadcastToRoom(roomId, {
      type: "questionAdded",
      payload: {
        question: newQuestion,
      },
    })

    console.log("Question added:", newQuestion)
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
    const session = sessions.find((s) => s.roomId === roomId)

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

    // Notify all clients in the room about the vote
    broadcastToRoom(roomId, {
      type: "voteUpdated",
      payload: {
        question,
      },
    })

    console.log("Vote recorded:", voteType, question)
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
    const session = sessions.find((s) => s.roomId === roomId)

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

    if (action === "answered") {
      question.answered = true
    } else if (action === "unanswered") {
      question.answered = false
    } else if (action === "highlighted") {
      question.highlighted = true
    } else if (action === "unhighlighted") {
      question.highlighted = false
    } else {
      socket.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Invalid action" },
        })
      )
      return
    }

    // Notify all clients in the room
    broadcastToRoom(roomId, {
      type: "questionUpdated",
      payload: {
        question,
      },
    })

    console.log("Question updated:", action, question)
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
    const session = sessions.find((s) => s.roomId === roomId)

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

    // Notify other clients in the room
    broadcastToRoom(
      roomId,
      {
        type: "attendeeLeft",
        payload: {
          attendee,
          attendees: session.attendees,
        },
      },
      socket
    )

    console.log("Attendee left:", attendee, "from room:", roomId)
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

    sessions.splice(sessionIndex, 1)

    // Notify all clients in the room
    broadcastToRoom(roomId, {
      type: "sessionClosed",
      payload: {
        message: "Session has been closed by the presenter",
      },
    })

    console.log("Session closed:", roomId)
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