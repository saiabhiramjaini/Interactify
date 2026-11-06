import { Types } from 'mongoose';
import { SessionModel } from '../../db/models/sessionModel';
import { SessionWriter, getWriter } from '../../db/writer';
import { DuplicateKeyError, SessionError } from '../../errors';
import { Session, Question, Attendee } from '../../types';
import { generateOwnerToken, generateRoomId, tokensMatch } from '../../utils/generateRoomId';

const MAX_ROOM_ID_ATTEMPTS = 5;

export type MarkAction = 'answered' | 'unanswered' | 'highlighted' | 'unhighlighted';

const MARK_UPDATES: Record<MarkAction, Record<string, boolean>> = {
  answered: { 'questions.$.answered': true },
  unanswered: { 'questions.$.answered': false },
  highlighted: { 'questions.$.highlighted': true },
  unhighlighted: { 'questions.$.highlighted': false },
};

export const isMarkAction = (action: string): action is MarkAction => action in MARK_UPDATES;

const normalizeQuestionText = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

interface SessionServiceDeps {
  getWriter: () => SessionWriter;
  generateRoomId: () => string;
}

export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  private get writer(): SessionWriter {
    return this.deps.getWriter();
  }

  // Whitelists the fields clients may see; ownerToken and normalizedText never leave the server.
  private transformSession(doc: any): Session {
    return {
      _id: String(doc._id),
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
      _id: String(doc._id),
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

  private async getSessionDoc(roomId: string) {
    const session = await SessionModel.findOne({ roomId });
    if (!session) throw new SessionError('NOT_FOUND', 'Session not found');
    return session;
  }

  private async getActiveSessionDoc(roomId: string) {
    const session = await this.getSessionDoc(roomId);
    if (session.sessionStatus !== 'active') {
      throw new SessionError('SESSION_CLOSED', 'This session has ended');
    }
    return session;
  }

  private assertValidQuestionId(questionId: string): void {
    if (!Types.ObjectId.isValid(questionId)) {
      throw new SessionError('QUESTION_NOT_FOUND', 'Question not found');
    }
  }

  private assertAttendee(session: { attendees: { id: string }[] }, attendeeId: string): void {
    if (!session.attendees.some((a) => a.id === attendeeId)) {
      throw new SessionError('NOT_ATTENDEE', 'You are not part of this session. Please rejoin.');
    }
  }

  private async questionResult(roomId: string, questionId: string) {
    const session = await this.getSessionDoc(roomId);
    const question = session.questions.id(questionId);
    if (!question) throw new SessionError('QUESTION_NOT_FOUND', 'Question not found');
    return {
      question: this.transformQuestion(question),
      session: this.transformSession(session)
    };
  }

  async createSession(sessionName: string, owner: string): Promise<{ session: Session; ownerToken: string }> {
    for (let attempt = 0; attempt < MAX_ROOM_ID_ATTEMPTS; attempt++) {
      const roomId = this.deps.generateRoomId();
      const ownerToken = generateOwnerToken();

      try {
        await this.writer.create({
          sessionName,
          roomId,
          owner,
          ownerToken,
          attendees: [],
          questions: []
        });
      } catch (error) {
        if (error instanceof DuplicateKeyError) continue; // Room code taken; try another.
        throw error;
      }

      const session = await this.getSessionDoc(roomId);
      return { session: this.transformSession(session), ownerToken };
    }

    throw new SessionError('ROOM_CODE_EXHAUSTED', 'Could not allocate a room code. Please try again.');
  }

  async findSession(roomId: string): Promise<Session> {
    return this.transformSession(await this.getActiveSessionDoc(roomId));
  }

  async verifyPresenter(roomId: string, ownerToken: string): Promise<Session> {
    const session = await this.getActiveSessionDoc(roomId);
    if (!tokensMatch(session.ownerToken, ownerToken)) {
      throw new SessionError('FORBIDDEN', 'You are not the presenter of this session');
    }
    return this.transformSession(session);
  }

  // `added` is false when the attendee was already in the session (a rejoin)
  async joinSession(roomId: string, attendee: Attendee): Promise<{ session: Session; added: boolean }> {
    await this.getActiveSessionDoc(roomId);

    // Conditional on the id so a rejoin (possibly under a new name) never adds a duplicate entry
    const result = await this.writer.updateOne(
      { roomId, sessionStatus: 'active', 'attendees.id': { $ne: attendee.id } },
      { $push: { attendees: { id: attendee.id, name: attendee.name } } }
    );

    const session = this.transformSession(await this.getActiveSessionDoc(roomId));
    return { session, added: result.modified > 0 };
  }

  // Returns null when the session no longer exists (nothing to notify)
  async leaveSession(roomId: string, attendeeId: string): Promise<Session | null> {
    await this.writer.updateOne(
      { roomId },
      { $pull: { attendees: { id: attendeeId } } }
    );

    const session = await SessionModel.findOne({ roomId });
    return session ? this.transformSession(session) : null;
  }

  async addQuestion(roomId: string, questionText: string, authorId: string, authorName: string): Promise<{ question: Question; session: Session }> {
    const normalizedText = normalizeQuestionText(questionText);

    const assertCanAsk = (session: Awaited<ReturnType<SessionService['getActiveSessionDoc']>>) => {
      this.assertAttendee(session, authorId);
      // Compares against questionText too, for questions stored before normalizedText existed
      const duplicate = session.questions.some(
        (q) => (q.normalizedText || normalizeQuestionText(q.questionText)) === normalizedText
      );
      if (duplicate) {
        throw new SessionError('DUPLICATE_QUESTION', 'A similar question already exists. Please upvote that question instead.');
      }
    };

    assertCanAsk(await this.getActiveSessionDoc(roomId));

    const questionId = new Types.ObjectId();
    // The conditions are repeated in the update so a concurrent duplicate or leave can't slip in
    const result = await this.writer.updateOne(
      {
        roomId,
        sessionStatus: 'active',
        'attendees.id': authorId,
        'questions.normalizedText': { $ne: normalizedText }
      },
      {
        $push: {
          questions: {
            _id: questionId,
            questionText: questionText.trim(),
            normalizedText,
            upVotes: 0,
            upVotedBy: [],
            authorId,
            authorName,
            answered: false,
            highlighted: false
          }
        }
      }
    );

    if (result.matched === 0) {
      assertCanAsk(await this.getActiveSessionDoc(roomId));
      throw new SessionError('WRITE_FAILED', 'Failed to add question');
    }

    return this.questionResult(roomId, questionId.toString());
  }

  // Toggles the voter's upvote
  async voteQuestion(roomId: string, questionId: string, voterId: string): Promise<{ question: Question; session: Session }> {
    this.assertValidQuestionId(questionId);

    const session = await this.getActiveSessionDoc(roomId);
    this.assertAttendee(session, voterId);

    const question = session.questions.id(questionId);
    if (!question) throw new SessionError('QUESTION_NOT_FOUND', 'Question not found');

    const hasVoted = question.upVotedBy.includes(voterId);

    // The vote state is part of the match, so the count and upVotedBy can't drift
    // apart under concurrent votes; a repeated toggle simply matches nothing.
    if (hasVoted) {
      await this.writer.updateOne(
        { roomId, sessionStatus: 'active', questions: { $elemMatch: { _id: questionId, upVotedBy: voterId } } },
        {
          $pull: { 'questions.$.upVotedBy': voterId },
          $inc: { 'questions.$.upVotes': -1 }
        }
      );
    } else {
      await this.writer.updateOne(
        { roomId, sessionStatus: 'active', questions: { $elemMatch: { _id: questionId, upVotedBy: { $ne: voterId } } } },
        {
          $push: { 'questions.$.upVotedBy': voterId },
          $inc: { 'questions.$.upVotes': 1 }
        }
      );
    }

    return this.questionResult(roomId, questionId);
  }

  // Callers must have verified the presenter
  async markQuestion(roomId: string, questionId: string, action: MarkAction): Promise<{ question: Question; session: Session }> {
    this.assertValidQuestionId(questionId);

    const result = await this.writer.updateOne(
      { roomId, sessionStatus: 'active', 'questions._id': questionId },
      { $set: MARK_UPDATES[action] }
    );

    if (result.matched === 0) {
      await this.getActiveSessionDoc(roomId);
      throw new SessionError('QUESTION_NOT_FOUND', 'Question not found');
    }

    return this.questionResult(roomId, questionId);
  }

  // Callers must have verified the presenter. Closed sessions are kept so late
  // joiners get a clear "session has ended" instead of "not found".
  async closeSession(roomId: string): Promise<void> {
    const result = await this.writer.updateOne(
      { roomId, sessionStatus: 'active' },
      { $set: { sessionStatus: 'closed' } }
    );

    if (result.matched === 0) {
      await this.getActiveSessionDoc(roomId);
    }
  }

  async getAllActiveSessions(): Promise<Session[]> {
    const sessions = await SessionModel.find({ sessionStatus: 'active' });
    return sessions.map(session => this.transformSession(session));
  }
}

export const sessionService = new SessionService({ getWriter, generateRoomId });
