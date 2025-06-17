import { SessionModel } from '../../db/models/sessionModel';
import { Session, Question, Attendee } from '../../types';
import { generateRoomId } from '../../utils/generateRoomId';

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
    
    if (attendee.id === session.owner) {
      return this.transformSession(session);
    }

    const updatedSession = await SessionModel.findOneAndUpdate(
      { roomId },
      { $addToSet: { attendees: { id: attendee.id, name: attendee.name } } },
      { new: true }
    );

    return updatedSession ? this.transformSession(updatedSession) : null;
  }

  async leaveSession(roomId: string, attendeeId: string): Promise<Session | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;

    const updatedSession = await SessionModel.findOneAndUpdate(
      { roomId },
      { $pull: { attendees: { id: attendeeId } } },
      { new: true }
    );

    return updatedSession ? this.transformSession(updatedSession) : null;
  }

  async addQuestion(roomId: string, questionText: string, authorId: string, authorName: string): Promise<{ question: Question; session: Session } | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;

    const normalizedText = questionText.trim().toLowerCase();
    const duplicate = session.questions.some(q => q.questionText.trim().toLowerCase() === normalizedText);
    if (duplicate) return null;

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

    const updatedSession = await SessionModel.findOneAndUpdate(
      { roomId },
      { $push: { questions: newQuestion } },
      { new: true }
    );

    if (!updatedSession) return null;

    const addedQuestion = updatedSession.questions.find(q => 
      q.questionText === questionText && 
      q.authorId === authorId
    );

    if (!addedQuestion) {
      console.error('Question was not found after adding');
      return null;
    }

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
    
    let updatedSession;
    if (hasVoted) {
      // Remove vote (toggle off)
      updatedSession = await SessionModel.findOneAndUpdate(
        { roomId, 'questions._id': questionId },
        {
          $pull: { 'questions.$.upVotedBy': voterId },
          $inc: { 'questions.$.upVotes': -1 }
        },
        { new: true }
      );
    } else {
      // Add vote
      updatedSession = await SessionModel.findOneAndUpdate(
        { roomId, 'questions._id': questionId },
        {
          $addToSet: { 'questions.$.upVotedBy': voterId },
          $inc: { 'questions.$.upVotes': 1 }
        },
        { new: true }
      );
    }

    if (!updatedSession) return null;

    const updatedQuestion = updatedSession.questions.id(questionId);
    if (!updatedQuestion) return null;

    return {
      question: this.transformQuestion(updatedQuestion),
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

    let update: any = {};
    switch (action) {
      case 'answered':
        update = { 'questions.$.answered': true };
        break;
      case 'unanswered':
        update = { 'questions.$.answered': false };
        break;
      case 'highlighted':
        update = { 'questions.$.highlighted': true };
        break;
      case 'unhighlighted':
        update = { 'questions.$.highlighted': false };
        break;
      default:
        return null;
    }

    const updatedSession = await SessionModel.findOneAndUpdate(
      { roomId, 'questions._id': questionId },
      { $set: update },
      { new: true }
    );

    if (!updatedSession) return null;

    const updatedQuestion = updatedSession.questions.id(questionId);
    if (!updatedQuestion) return null;

    return {
      question: this.transformQuestion(updatedQuestion),
      session: this.transformSession(updatedSession)
    };
  }

  async closeSession(roomId: string, ownerId: string): Promise<boolean> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return false;

    // Only owner can close the session
    if (session.owner !== ownerId) return false;

    const updatedSession = await SessionModel.findOneAndUpdate(
      { roomId },
      { $set: { sessionStatus: 'closed' } },
      { new: true }
    );

    return !!updatedSession;
  }

  async getAllActiveSessions(): Promise<Session[]> {
    const sessions = await SessionModel.find({ sessionStatus: 'active' });
    return sessions.map(session => this.transformSession(session));
  }
}

export const sessionService = new SessionService();