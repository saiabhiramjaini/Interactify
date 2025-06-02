import { SessionModel } from '../db/models/sessionModel';
import { Session, Question, Attendee } from '../types';
import { generateRoomId } from '../utils/generateRoomId';

class SessionService {
  private transformSession(doc: any): Session {
    return {
      _id: doc._id,
      sessionName: doc.sessionName,
      roomId: doc.roomId,
      owner: doc.owner,
      attendees: doc.attendees.map((a: any) => ({ id: a.id, name: a.name })),
      questions: doc.questions.map((q: any) => this.transformQuestion(q)),
      sessionStatus: doc.sessionStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private transformQuestion(doc: any): Question {
    return {
      _id: doc._id,
      questionText: doc.questionText,
      upVotes: doc.upVotes,
      upVotedBy: doc.upVotedBy,
      authorId: doc.authorId,
      authorName: doc.authorName,
      answered: doc.answered,
      highlighted: doc.highlighted,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  async createSession(sessionName: string, owner: string): Promise<Session> {
    const roomId = generateRoomId();
    
    const newSession = new SessionModel({
      sessionName,
      roomId,
      owner,
      attendees: [],
      questions: []
    });

    const savedSession = await newSession.save();
    return this.transformSession(savedSession);
  }

  async findSession(roomId: string): Promise<Session | null> {
    const session = await SessionModel.findOne({ roomId });
    return session ? this.transformSession(session) : null;
  }

  async joinSession(roomId: string, attendee: Attendee): Promise<Session | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;
    // Do not add owner as attendee
    if (attendee.id === session.owner) {
      return this.transformSession(session);
    }
    // Use $addToSet to deduplicate attendees
    await SessionModel.updateOne(
      { roomId },
      { $addToSet: { attendees: { id: attendee.id, name: attendee.name } } }
    );
    const updatedSession = await SessionModel.findOne({ roomId });
    return this.transformSession(updatedSession);
  }

  async leaveSession(roomId: string, attendeeId: string): Promise<Session | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;

    session.attendees.pull({ id: attendeeId });
    const updatedSession = await session.save();
    return this.transformSession(updatedSession);
  }

  async addQuestion(roomId: string, questionText: string, authorId: string, authorName: string): Promise<{ question: Question; session: Session } | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;

    // Prevent duplicate questions (case-insensitive, trimmed)
    const normalizedText = questionText.trim().toLowerCase();
    const duplicate = session.questions.some(q => q.questionText.trim().toLowerCase() === normalizedText);
    if (duplicate) return null;

    // Verify author is an attendee by id
    const isAttendee = session.attendees.some(a => a.id === authorId);
    if (!isAttendee) return null;

    const newQuestion = {
      questionText,
      upVotes: 0,
      upVotedBy: [],
      authorId,
      authorName,
      answered: false,
      highlighted: false
    };

    session.questions.push(newQuestion);
    const updatedSession = await session.save();
    // Get the newly added question (last one in array)
    const addedQuestion = updatedSession.questions[updatedSession.questions.length - 1];
    return {
      question: this.transformQuestion(addedQuestion),
      session: this.transformSession(updatedSession)
    };
  }

  async voteQuestion(roomId: string, questionId: string, voterId: string): Promise<{ question: Question; session: Session } | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;

    // Verify voter is an attendee
    const isAttendee = session.attendees.some(a => a.id === voterId);
    if (!isAttendee) return null;

    const question = session.questions.id(questionId);
    if (!question) return null;

    // Check if user already voted
    const hasVoted = question.upVotedBy.includes(voterId);
    
    if (hasVoted) {
      // Remove vote (toggle off)
      question.upVotedBy = question.upVotedBy.filter(id => id !== voterId);
      question.upVotes = Math.max(0, question.upVotes - 1);
    } else {
      // Add vote
      question.upVotedBy.push(voterId);
      question.upVotes += 1;
    }

    const updatedSession = await session.save();
    return {
      question: this.transformQuestion(question),
      session: this.transformSession(updatedSession)
    };
  }

  async markQuestion(roomId: string, questionId: string, action: string, userId: string): Promise<{ question: Question; session: Session } | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;

    // Only owner can mark questions
    if (session.owner !== userId) return null;

    const question = session.questions.id(questionId);
    if (!question) return null;

    switch (action) {
      case 'answered':
        question.answered = true;
        break;
      case 'unanswered':
        question.answered = false;
        break;
      case 'highlighted':
        question.highlighted = true;
        break;
      case 'unhighlighted':
        question.highlighted = false;
        break;
      default:
        return null;
    }

    const updatedSession = await session.save();
    return {
      question: this.transformQuestion(question),
      session: this.transformSession(updatedSession)
    };
  }

  async closeSession(roomId: string, ownerId: string): Promise<boolean> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return false;

    // Only owner can close session
    if (session.owner !== ownerId) return false;

    session.sessionStatus = 'closed';
    await session.save();
    return true;
  }

  async getAllActiveSessions(): Promise<Session[]> {
    const sessions = await SessionModel.find({});
    return sessions.map(session => this.transformSession(session));
  }
}

export const sessionService = new SessionService();