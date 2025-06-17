import { WebSocket } from 'ws';
import { sessionService } from '../services/sessionService';
import { websocketService } from '../services/websocketService';

export const handleCreateSession = async (socket: WebSocket, payload: any) => {
  try {
    const { sessionName, owner } = payload;

    if (!sessionName || !owner) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Session name and owner are required' }
      });
      return;
    }

    const session = await sessionService.createSession(sessionName, owner);

    websocketService.sendToClient(socket, {
      type: 'sessionCreated',
      payload: { session }
    });

  } catch (error) {
    console.error('Error creating session:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to create session' }
    });
  }
};

export const handleJoinSession = async (socket: WebSocket, payload: any) => {
  try {
    const { roomId, attendee } = payload;

    if (!roomId || !attendee || !attendee.id || !attendee.name) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Room ID and attendee details (id, name) are required' }
      });
      return;
    }

    const session = await sessionService.joinSession(roomId, attendee);

    if (!session) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Session not found' }
      });
      return;
    }

    // Update client connection
    websocketService.updateClientRoom(socket, roomId, attendee);

    // Send success response to the joining client
    websocketService.sendToClient(socket, {
      type: 'sessionJoined',
      payload: { session }
    });

    // Broadcast to other clients in the room
    websocketService.broadcastToRoom(roomId, {
      type: 'attendeeJoined',
      payload: { 
        attendee, 
        attendees: session.attendees 
      }
    }, socket);

  } catch (error) {
    console.error('Error joining session:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to join session' }
    });
  }
};

export const handleGetSession = async (socket: WebSocket, payload: any) => {
  try {
    const { roomId } = payload;

    if (!roomId) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Room ID is required' }
      });
      return;
    }

    const session = await sessionService.findSession(roomId);

    if (!session) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Session not found' }
      });
      return;
    }

    websocketService.sendToClient(socket, {
      type: 'sessionData',
      payload: { session }
    });

  } catch (error) {
    console.error('Error getting session:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to get session data' }
    });
  }
};

export const handleQuestion = async (socket: WebSocket, payload: any) => {
  try {
    const { roomId, questionText, authorId, authorName } = payload;

    if (!roomId || !questionText || !authorId || !authorName) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Room ID, question text, authorId, and authorName are required' }
      });
      return;
    }

    const result = await sessionService.addQuestion(roomId, questionText, authorId, authorName);

    if (!result) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'A similar question already exists. Please upvote that question instead.' }
      });
      return;
    }

    // Broadcast to all clients in the room
    websocketService.broadcastToRoom(roomId, {
      type: 'questionAdded',
      payload: {
        question: result.question,
        session: result.session
      }
    });

  } catch (error) {
    console.error('Error adding question:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to add question' }
    });
  }
};

export const handleVote = async (socket: WebSocket, payload: any) => {
  try {
    const { roomId, questionId, voterId } = payload;

    if (!roomId || !questionId || !voterId) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Room ID, question ID, and voter ID are required' }
      });
      return;
    }

    const result = await sessionService.voteQuestion(roomId, questionId, voterId);

    if (!result) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Failed to vote. Make sure you are part of the session and question exists.' }
      });
      return;
    }

    // Broadcast to all clients in the room
    websocketService.broadcastToRoom(roomId, {
      type: 'questionUpdated',
      payload: {
        question: result.question,
        session: result.session
      }
    });

  } catch (error) {
    console.error('Error voting on question:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to vote on question' }
    });
  }
};

export const handleMarkQuestion = async (socket: WebSocket, payload: any) => {
  try {
    const { roomId, questionId, action, userId } = payload;

    if (!roomId || !questionId || !action || !userId) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Room ID, question ID, action, and user ID are required' }
      });
      return;
    }

    const result = await sessionService.markQuestion(roomId, questionId, action, userId);

    if (!result) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Failed to mark question. Only session owner can perform this action.' }
      });
      return;
    }

    // Broadcast to all clients in the room
    websocketService.broadcastToRoom(roomId, {
      type: 'questionUpdated',
      payload: {
        question: result.question,
        session: result.session
      }
    });

  } catch (error) {
    console.error('Error marking question:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to mark question' }
    });
  }
};

export const handleLeaveSession = async (socket: WebSocket, payload: any) => {
  try {
    const { roomId, attendeeId } = payload;

    if (!roomId || !attendeeId) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Room ID and attendee ID are required' }
      });
      return;
    }

    const session = await sessionService.leaveSession(roomId, attendeeId);

    if (!session) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Session not found' }
      });
      return;
    }

    // Clear client room
    websocketService.clearClientRoom(socket);

    // Get attendee info before broadcasting
    const client = websocketService.getClientBySocket(socket);
    const leftAttendee = client?.attendee;

    // Send success response to the leaving client
    websocketService.sendToClient(socket, {
      type: 'success',
      payload: { message: 'Left session successfully' }
    });

    // Broadcast to other clients in the room
    if (leftAttendee) {
      websocketService.broadcastToRoom(roomId, {
        type: 'attendeeLeft',
        payload: { 
          attendee: leftAttendee,
          attendees: session.attendees 
        }
      }, socket);
    }

  } catch (error) {
    console.error('Error leaving session:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to leave session' }
    });
  }
};

export const handleCloseSession = async (socket: WebSocket, payload: any) => {
  try {
    const { roomId, ownerId } = payload;

    if (!roomId || !ownerId) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Room ID and owner ID are required' }
      });
      return;
    }

    const success = await sessionService.closeSession(roomId, ownerId);

    if (!success) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: 'Failed to close session. Only session owner can close the session.' }
      });
      return;
    }

    // Broadcast to all clients in the room
    websocketService.broadcastToRoom(roomId, {
      type: 'sessionClosed',
      payload: { message: 'Session has been closed by the owner' }
    });

    // Clear all clients from this room
    websocketService.clearClientsFromRoom(roomId);

  } catch (error) {
    console.error('Error closing session:', error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: 'Failed to close session' }
    });
  }
};
