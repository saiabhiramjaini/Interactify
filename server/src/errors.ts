export type SessionErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'SESSION_CLOSED'
  | 'FORBIDDEN'
  | 'NOT_IN_SESSION'
  | 'NOT_ATTENDEE'
  | 'QUESTION_NOT_FOUND'
  | 'DUPLICATE_QUESTION'
  | 'ROOM_CODE_EXHAUSTED'
  | 'WRITE_FAILED';

// An expected, user-facing failure. Handlers send `message` and `code` to the client.
export class SessionError extends Error {
  constructor(public readonly code: SessionErrorCode, message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

// Raised by writers when an insert collides with a unique index (e.g. roomId).
export class DuplicateKeyError extends Error {
  constructor(message = 'Duplicate key') {
    super(message);
    this.name = 'DuplicateKeyError';
  }
}
