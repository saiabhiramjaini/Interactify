import { WebSocket } from "ws";

export interface Attendee {
  id: string;
  name: string;
}

export interface Question {
  _id?: string;
  questionText: string;
  upVotes: number;
  upVotedBy: string[];
  authorId: string;
  authorName: string;
  answered: boolean;
  highlighted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Session {
  _id?: string;
  sessionName: string;
  roomId: string;
  owner: string;
  attendees: Attendee[];
  questions: Question[];
  sessionStatus: "active" | "closed";
  createdAt?: Date;
  updatedAt?: Date;
}

export type ClientRole = "attendee" | "presenter";

export interface ClientConnection {
  socket: WebSocket;
  roomId?: string;
  role?: ClientRole;
  // Set when role is "attendee"; the identity the server acts on for this socket.
  attendee?: Attendee;
}

export interface MessagePayload {
  type: string;
  payload: any;
}

// Response message types for client communication
export interface SuccessResponse {
  type: 'success';
  payload: {
    message: string;
    data?: any;
  };
}

export interface ErrorResponse {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
}

export interface SessionCreatedResponse {
  type: 'sessionCreated';
  payload: {
    session: Session;
    // Only ever sent to the presenter who created the session
    ownerToken: string;
  };
}

export interface SessionJoinedResponse {
  type: 'sessionJoined';
  payload: {
    session: Session;
    role: ClientRole;
  };
}

export interface SessionDataResponse {
  type: 'sessionData';
  payload: {
    session: Session;
  };
}

export interface QuestionAddedResponse {
  type: 'questionAdded';
  payload: {
    question: Question;
    session: Session;
  };
}

export interface QuestionUpdatedResponse {
  type: 'questionUpdated';
  payload: {
    question: Question;
    session: Session;
  };
}

export interface AttendeeJoinedResponse {
  type: 'attendeeJoined';
  payload: {
    attendee: Attendee;
    attendees: Attendee[];
  };
}

export interface AttendeeLeftResponse {
  type: 'attendeeLeft';
  payload: {
    attendee: Attendee;
    attendees: Attendee[];
  };
}

export interface SessionClosedResponse {
  type: 'sessionClosed';
  payload: {
    message: string;
  };
}