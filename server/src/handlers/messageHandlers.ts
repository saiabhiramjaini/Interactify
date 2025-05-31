import { WebSocket } from "ws";
import { SessionModel } from '../db/models/sessionModel';
import { websocketService } from '../services/websocketService';
import { generateRoomId } from '../utils/generateRoomId';

export const handleCreateSession = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { sessionName, owner } = payload;
    const roomId = generateRoomId();

    const newSession = await SessionModel.create({
      sessionName,
      roomId,
      owner,
      attendees: [owner],
      questions: []
    });

    websocketService.sendToClient(socket, {
      type: "sessionCreated",
      payload: { roomId, sessionName, owner },
    });
  } catch (error) {
    console.error("Error creating session:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error creating session" },
    });
  }
};

export const handleJoinSession = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { roomId, attendee } = payload;
    
    const session = await SessionModel.findOneAndUpdate(
      { roomId },
      { $addToSet: { attendees: attendee } },
      { new: true }
    );

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found" },
      });
      return;
    }

    websocketService.updateClientRoom(socket, roomId, attendee);

    websocketService.sendToClient(socket, {
      type: "sessionJoined",
      payload: {
        sessionName: session.sessionName,
        owner: session.owner,
        attendees: session.attendees,
        questions: session.questions,
      },
    });

    websocketService.broadcastToRoom(roomId, {
      type: "attendeeJoined",
      payload: { attendee, attendees: session.attendees },
    }, socket);
  } catch (error) {
    console.error("Error joining session:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error joining session" },
    });
  }
};

export const handleGetSession = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { roomId } = payload;
    const session = await SessionModel.findOne({ roomId });

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found" },
      });
      return;
    }

    websocketService.sendToClient(socket, {
      type: "sessionData",
      payload: {
        sessionName: session.sessionName,
        owner: session.owner,
        attendees: session.attendees,
        questions: session.questions,
      },
    });
  } catch (error) {
    console.error("Error getting session:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error getting session data" },
    });
  }
};

export const handleQuestion = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { roomId, questionText, author } = payload;
    
    // Verify attendee is in session
    const session = await SessionModel.findOne({ 
      roomId, 
      attendees: author 
    });

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found or you must join the session to ask a question" },
      });
      return;
    }

    const newQuestion = {
      questionText,
      author,
      upVotes: 0,
      downVotes: 0,
      answered: false,
      highlighted: false,
      createdAt: new Date()
    };

    const updatedSession = await SessionModel.findOneAndUpdate(
      { roomId },
      { $push: { questions: newQuestion } },
      { new: true }
    );

    websocketService.broadcastToRoom(roomId, {
      type: "question",
      payload: updatedSession!.questions.slice(-1)[0], // Get the last added question
    });
  } catch (error) {
    console.error("Error adding question:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error adding question" },
    });
  }
};

export const handleVote = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { roomId, questionText, voteType } = payload;
    
    if (voteType !== 'upVote' && voteType !== 'downVote') {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Invalid vote type" },
      });
      return;
    }

    const updateField = voteType === 'upVote' ? 'questions.$.upVotes' : 'questions.$.downVotes';
    
    const session = await SessionModel.findOneAndUpdate(
      { 
        roomId, 
        "questions.questionText": questionText 
      },
      { $inc: { [updateField]: 1 } },
      { new: true }
    );

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session or question not found" },
      });
      return;
    }

    const updatedQuestion = session.questions.find((q: { questionText: any; }) => q.questionText === questionText);
    
    websocketService.broadcastToRoom(roomId, {
      type: "vote",
      payload: {
        questionText,
        upVotes: updatedQuestion!.upVotes,
        downVotes: updatedQuestion!.downVotes,
      },
    });
  } catch (error) {
    console.error("Error voting:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error voting" },
    });
  }
};

export const handleMarkQuestion = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { roomId, questionText, action } = payload;
    
    let update: any = {};
    switch (action) {
      case "answered":
        update = { "questions.$.answered": true };
        break;
      case "unanswered":
        update = { "questions.$.answered": false };
        break;
      case "highlighted":
        update = { "questions.$.highlighted": true };
        break;
      case "unhighlighted":
        update = { "questions.$.highlighted": false };
        break;
      default:
        websocketService.sendToClient(socket, {
          type: "error",
          payload: { message: "Invalid action" },
        });
        return;
    }

    const session = await SessionModel.findOneAndUpdate(
      { 
        roomId, 
        "questions.questionText": questionText 
      },
      update,
      { new: true }
    );

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session or question not found" },
      });
      return;
    }

    const updatedQuestion = session.questions.find((q: { questionText: any; }) => q.questionText === questionText);
    const updatePayload = {
      questionText,
      answered: updatedQuestion!.answered,
      highlighted: updatedQuestion!.highlighted,
    };

    websocketService.broadcastToRoom(roomId, {
      type: "markQuestion",
      payload: updatePayload,
    });
  } catch (error) {
    console.error("Error marking question:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error marking question" },
    });
  }
};

export const handleLeaveSession = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { roomId, attendee } = payload;
    
    const session = await SessionModel.findOneAndUpdate(
      { roomId },
      { $pull: { attendees: attendee } },
      { new: true }
    );

    if (!session) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found" },
      });
      return;
    }

    websocketService.clearClientRoom(socket);

    websocketService.broadcastToRoom(roomId, {
      type: "attendeeLeft",
      payload: { attendee, attendees: session.attendees },
    }, socket);
  } catch (error) {
    console.error("Error leaving session:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error leaving session" },
    });
  }
};

export const handleCloseSession = async (socket: WebSocket, payload: any): Promise<void> => {
  try {
    const { roomId, owner } = payload;
    
    const result = await SessionModel.deleteOne({ 
      roomId, 
      owner 
    });

    if (result.deletedCount === 0) {
      websocketService.sendToClient(socket, {
        type: "error",
        payload: { message: "Session not found or only the owner can close the session" },
      });
      return;
    }

    websocketService.broadcastToRoom(roomId, {
      type: "sessionClosed",
      payload: { roomId },
    });

    websocketService.clearClientsFromRoom(roomId);
  } catch (error) {
    console.error("Error closing session:", error);
    websocketService.sendToClient(socket, {
      type: "error",
      payload: { message: "Error closing session" },
    });
  }
};