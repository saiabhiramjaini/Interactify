import { WebSocket } from 'ws';
import { sessionService, isMarkAction } from '../services/sessionService';
import { websocketService } from '../services/websocketService';
import { SessionError } from '../../errors';
import { Attendee, ClientConnection } from '../../types';
import { normalizeRoomId } from '../../utils/generateRoomId';

const MAX_NAME_LENGTH = 50;
const MAX_SESSION_NAME_LENGTH = 100;
const MAX_QUESTION_LENGTH = 500;
const MAX_ID_LENGTH = 100;

type Handler = (socket: WebSocket, payload: any) => Promise<void>;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const invalid = (message: string) => new SessionError('INVALID_INPUT', message);

const readRoomId = (payload: any): string => {
  const roomId = normalizeRoomId(str(payload?.roomId));
  if (!roomId) throw invalid('Room ID is required');
  return roomId;
};

// Converts thrown errors into an `error` message for the client. SessionErrors are
// expected and shown as-is; anything else is logged and replaced by `fallback`.
const withErrors = (fallback: string, handler: Handler): Handler => async (socket, payload) => {
  try {
    await handler(socket, payload);
  } catch (error) {
    if (error instanceof SessionError) {
      websocketService.sendToClient(socket, {
        type: 'error',
        payload: { message: error.message, code: error.code }
      });
      return;
    }
    console.error(`${fallback}:`, error);
    websocketService.sendToClient(socket, {
      type: 'error',
      payload: { message: fallback }
    });
  }
};

const requireAttendee = (socket: WebSocket, roomId: string): ClientConnection & { attendee: Attendee } => {
  const client = websocketService.getClientBySocket(socket);
  if (!client || client.roomId !== roomId || client.role !== 'attendee' || !client.attendee) {
    throw new SessionError('NOT_IN_SESSION', 'Join the session first');
  }
  return client as ClientConnection & { attendee: Attendee };
};

const requirePresenter = (socket: WebSocket, roomId: string): void => {
  const client = websocketService.getClientBySocket(socket);
  if (!client || client.roomId !== roomId || client.role !== 'presenter') {
    throw new SessionError('FORBIDDEN', 'Only the presenter can do this');
  }
};

// Removes an attendee from the session and tells the rest of the room. Skipped while
// another connection on this server (e.g. a second tab) still holds the same identity.
export const notifyAttendeeLeft = async (roomId: string, attendee: Attendee, excludeSocket?: WebSocket) => {
  const stillConnected = websocketService
    .getClients()
    .some((c) => c.roomId === roomId && c.role === 'attendee' && c.attendee?.id === attendee.id);
  if (stillConnected) return;

  const session = await sessionService.leaveSession(roomId, attendee.id);
  if (!session) return;

  websocketService.broadcastToRoom(roomId, {
    type: 'attendeeLeft',
    payload: { attendee, attendees: session.attendees }
  }, excludeSocket);
};

// Unbinds the socket from its current room unless it is rejoining with the same identity
const leaveCurrentRoom = async (socket: WebSocket, nextRoomId: string, nextAttendeeId?: string) => {
  const client = websocketService.getClientBySocket(socket);
  if (!client?.roomId) return;
  if (client.roomId === nextRoomId && client.attendee?.id === nextAttendeeId) return;

  const { roomId, role, attendee } = client;
  websocketService.clearClientRoom(socket);
  if (role === 'attendee' && attendee) {
    await notifyAttendeeLeft(roomId, attendee, socket);
  }
};

export const handleCreateSession = withErrors('Failed to create session', async (socket, payload) => {
  const sessionName = str(payload?.sessionName);
  const owner = str(payload?.owner);

  if (!sessionName || !owner) throw invalid('Session name and owner are required');
  if (sessionName.length > MAX_SESSION_NAME_LENGTH) {
    throw invalid(`Session name must be at most ${MAX_SESSION_NAME_LENGTH} characters`);
  }
  if (owner.length > MAX_NAME_LENGTH) throw invalid(`Name must be at most ${MAX_NAME_LENGTH} characters`);

  const { session, ownerToken } = await sessionService.createSession(sessionName, owner);

  websocketService.sendToClient(socket, {
    type: 'sessionCreated',
    payload: { session, ownerToken }
  });
});

// Presenters join with the ownerToken they received on creation; attendees with their id and name.
export const handleJoinSession = withErrors('Failed to join session', async (socket, payload) => {
  const roomId = readRoomId(payload);
  const ownerToken = str(payload?.ownerToken);

  if (ownerToken) {
    const session = await sessionService.verifyPresenter(roomId, ownerToken);
    await leaveCurrentRoom(socket, roomId);
    websocketService.updateClientRoom(socket, roomId, 'presenter');

    websocketService.sendToClient(socket, {
      type: 'sessionJoined',
      payload: { session, role: 'presenter' }
    });
    return;
  }

  const attendee: Attendee = {
    id: str(payload?.attendee?.id),
    name: str(payload?.attendee?.name),
  };
  if (!attendee.id || !attendee.name) {
    throw invalid('Room ID and attendee details (id, name) are required');
  }
  if (attendee.id.length > MAX_ID_LENGTH) throw invalid('Invalid attendee id');
  if (attendee.name.length > MAX_NAME_LENGTH) throw invalid(`Name must be at most ${MAX_NAME_LENGTH} characters`);

  await leaveCurrentRoom(socket, roomId, attendee.id);
  const { session, added } = await sessionService.joinSession(roomId, attendee);
  websocketService.updateClientRoom(socket, roomId, 'attendee', attendee);

  websocketService.sendToClient(socket, {
    type: 'sessionJoined',
    payload: { session, role: 'attendee' }
  });

  // Rejoins (reconnects, page navigation) aren't announced again
  if (added) {
    websocketService.broadcastToRoom(roomId, {
      type: 'attendeeJoined',
      payload: { attendee, attendees: session.attendees }
    }, socket);
  }
});

export const handleGetSession = withErrors('Failed to get session data', async (socket, payload) => {
  const session = await sessionService.findSession(readRoomId(payload));

  websocketService.sendToClient(socket, {
    type: 'sessionData',
    payload: { session }
  });
});

export const handleQuestion = withErrors('Failed to add question', async (socket, payload) => {
  const roomId = readRoomId(payload);
  const questionText = str(payload?.questionText);

  if (!questionText) throw invalid('Question text is required');
  if (questionText.length > MAX_QUESTION_LENGTH) {
    throw invalid(`Questions must be at most ${MAX_QUESTION_LENGTH} characters`);
  }

  const { attendee } = requireAttendee(socket, roomId);
  const result = await sessionService.addQuestion(roomId, questionText, attendee.id, attendee.name);

  websocketService.broadcastToRoom(roomId, {
    type: 'questionAdded',
    payload: result
  });
});

export const handleVote = withErrors('Failed to vote on question', async (socket, payload) => {
  const roomId = readRoomId(payload);
  const questionId = str(payload?.questionId);
  if (!questionId) throw invalid('Question ID is required');

  const { attendee } = requireAttendee(socket, roomId);
  const result = await sessionService.voteQuestion(roomId, questionId, attendee.id);

  websocketService.broadcastToRoom(roomId, {
    type: 'questionUpdated',
    payload: result
  });
});

export const handleMarkQuestion = withErrors('Failed to mark question', async (socket, payload) => {
  const roomId = readRoomId(payload);
  const questionId = str(payload?.questionId);
  const action = str(payload?.action);

  if (!questionId || !action) throw invalid('Question ID and action are required');
  if (!isMarkAction(action)) throw invalid('Unknown action');

  requirePresenter(socket, roomId);
  const result = await sessionService.markQuestion(roomId, questionId, action);

  websocketService.broadcastToRoom(roomId, {
    type: 'questionUpdated',
    payload: result
  });
});

export const handleLeaveSession = withErrors('Failed to leave session', async (socket, payload) => {
  const roomId = readRoomId(payload);

  const client = websocketService.getClientBySocket(socket);
  if (!client || client.roomId !== roomId) {
    throw new SessionError('NOT_IN_SESSION', 'You are not in this session');
  }

  // Read the identity before unbinding the socket
  const { role, attendee } = client;
  websocketService.clearClientRoom(socket);

  if (role === 'attendee' && attendee) {
    await notifyAttendeeLeft(roomId, attendee, socket);
  }

  websocketService.sendToClient(socket, {
    type: 'success',
    payload: { message: 'Left session successfully' }
  });
});

export const handleCloseSession = withErrors('Failed to close session', async (socket, payload) => {
  const roomId = readRoomId(payload);

  requirePresenter(socket, roomId);
  await sessionService.closeSession(roomId);

  // Every client in the room, the presenter included, is told before being unbound
  websocketService.broadcastToRoom(roomId, {
    type: 'sessionClosed',
    payload: { message: 'Session has been closed by the owner' }
  });

  websocketService.clearClientsFromRoom(roomId);
});
