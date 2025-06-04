import { SessionModel } from '../../db/models/sessionModel';
import { Session, Question, Attendee } from '../../types';
import { generateRoomId } from '../../utils/generateRoomId';
import { kafkaProducer } from '../../kafka/producer';

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
    
    const newSession = {
      sessionName,
      roomId,
      owner,
      attendees: [],
      questions: []
    };

    await kafkaProducer.sendDbOperation({
      type: 'create',
      collection: 'sessions',
      data: newSession
    });

    return this.transformSession(newSession);
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

    await kafkaProducer.sendDbOperation({
      type: 'update',
      collection: 'sessions',
      query: { roomId },
      data: { $addToSet: { attendees: { id: attendee.id, name: attendee.name } } }
    });

    const updatedSession = await SessionModel.findOne({ roomId });
    return updatedSession ? this.transformSession(updatedSession) : null;
  }

  async leaveSession(roomId: string, attendeeId: string): Promise<Session | null> {
    const session = await SessionModel.findOne({ roomId });
    if (!session) return null;

    await kafkaProducer.sendDbOperation({
      type: 'update',
      collection: 'sessions',
      query: { roomId },
      data: { $pull: { attendees: { id: attendeeId } } }
    });

    const updatedSession = await SessionModel.findOne({ roomId });
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

    // Send to Kafka
    await kafkaProducer.sendDbOperation({
      type: 'update',
      collection: 'sessions',
      query: { roomId },
      data: { $push: { questions: newQuestion } }
    });

    // Wait a bit for Kafka to process the message
    await new Promise(resolve => setTimeout(resolve, 100));

    // Fetch the updated session
    const updatedSession = await SessionModel.findOne({ roomId });
    if (!updatedSession) return null;

    // Find the newly added question
    const addedQuestion = updatedSession.questions.find(q => 
      q.questionText === questionText && 
      q.authorId === authorId
    );

    if (!addedQuestion) {
      console.error('Question was not found after Kafka processing');
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
    
    if (hasVoted) {
      // Remove vote (toggle off)
      await kafkaProducer.sendDbOperation({
        type: 'update',
        collection: 'sessions',
        query: { 
          roomId,
          'questions._id': questionId 
        },
        data: {
          $pull: { 'questions.$.upVotedBy': voterId },
          $inc: { 'questions.$.upVotes': -1 }
        }
      });
    } else {
      // Add vote
      await kafkaProducer.sendDbOperation({
        type: 'update',
        collection: 'sessions',
        query: { 
          roomId,
          'questions._id': questionId 
        },
        data: {
          $addToSet: { 'questions.$.upVotedBy': voterId },
          $inc: { 'questions.$.upVotes': 1 }
        }
      });
    }

    // Wait a bit for Kafka to process the message
    await new Promise(resolve => setTimeout(resolve, 100));

    // Fetch the updated session
    const updatedSession = await SessionModel.findOne({ roomId });
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

    let updateData: any = {};
    switch (action) {
      case 'answered':
        updateData = { 'questions.$.answered': true };
        break;
      case 'unanswered':
        updateData = { 'questions.$.answered': false };
        break;
      case 'highlighted':
        updateData = { 'questions.$.highlighted': true };
        break;
      case 'unhighlighted':
        updateData = { 'questions.$.highlighted': false };
        break;
      default:
        return null;
    }

    await kafkaProducer.sendDbOperation({
      type: 'update',
      collection: 'sessions',
      query: { 
        roomId,
        'questions._id': questionId 
      },
      data: { $set: updateData }
    });

    // Wait a bit for Kafka to process the message
    await new Promise(resolve => setTimeout(resolve, 100));

    // Fetch the updated session
    const updatedSession = await SessionModel.findOne({ roomId });
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

    // Only owner can close session
    if (session.owner !== ownerId) return false;

    // First mark the session as closed
    await kafkaProducer.sendDbOperation({
      type: 'update',
      collection: 'sessions',
      query: { roomId },
      data: { $set: { sessionStatus: 'closed' } }
    });

    // Wait a bit for Kafka to process the message
    await new Promise(resolve => setTimeout(resolve, 100));

    // Then delete the session after a delay
    setTimeout(async () => {
      try {
        await kafkaProducer.sendDbOperation({
          type: 'delete',
          collection: 'sessions',
          query: { roomId },
          data: {} // Add empty data object to satisfy type requirement
        });
        console.log(`Session ${roomId} deleted successfully`);
      } catch (error) {
        console.error(`Error deleting session ${roomId}:`, error);
      }
    }, 5000); // Wait 5 seconds before deleting to ensure all clients have received the close message

    return true;
  }

  async getAllActiveSessions(): Promise<Session[]> {
    const sessions = await SessionModel.find({});
    return sessions.map(session => this.transformSession(session));
  }
}

export const sessionService = new SessionService();