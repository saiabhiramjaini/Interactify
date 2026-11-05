import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { useTestDatabase } from './helpers';
import { SessionService } from '../src/ws/services/sessionService';
import { directWriter } from '../src/db/writer';
import { SessionModel } from '../src/db/models/sessionModel';
import { SessionError } from '../src/errors';
import { generateRoomId } from '../src/utils/generateRoomId';

useTestDatabase();

const service = new SessionService({ getWriter: () => directWriter, generateRoomId });

const rejectsWith = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) => error instanceof SessionError && error.code === code);

const createWithAttendee = async () => {
  const { session, ownerToken } = await service.createSession('Launch Q&A', 'Ada');
  await service.joinSession(session.roomId, { id: 'att-1', name: 'Bob' });
  return { roomId: session.roomId, ownerToken };
};

describe('SessionService', () => {
  it('returns the owner token separately and never inside the session', async () => {
    const { session, ownerToken } = await service.createSession('Launch Q&A', 'Ada');

    assert.ok(ownerToken.length >= 32);
    assert.equal(JSON.stringify(session).includes(ownerToken), false);
    assert.equal(JSON.stringify(await service.findSession(session.roomId)).includes(ownerToken), false);
  });

  it('only verifies the presenter with the correct token', async () => {
    const { session, ownerToken } = await service.createSession('Launch Q&A', 'Ada');

    await rejectsWith(service.verifyPresenter(session.roomId, 'Ada'), 'FORBIDDEN');
    await rejectsWith(service.verifyPresenter(session.roomId, ''), 'FORBIDDEN');
    const verified = await service.verifyPresenter(session.roomId, ownerToken);
    assert.equal(verified.roomId, session.roomId);
  });

  it('retries with a new room code when one is already taken', async () => {
    const codes = ['TAKEN1', 'TAKEN1', 'FRESH1'];
    const colliding = new SessionService({ getWriter: () => directWriter, generateRoomId: () => codes.shift()! });

    await colliding.createSession('First', 'Ada');
    const { session } = await colliding.createSession('Second', 'Grace');

    assert.equal(session.roomId, 'FRESH1');
  });

  it('does not add an attendee twice when they rejoin', async () => {
    const { roomId } = await createWithAttendee();
    const { session, added } = await service.joinSession(roomId, { id: 'att-1', name: 'Bob renamed' });

    assert.equal(added, false);
    assert.equal(session.attendees.length, 1);
  });

  it('rejects duplicate questions regardless of case and spacing', async () => {
    const { roomId } = await createWithAttendee();
    await service.addQuestion(roomId, 'What is the roadmap?', 'att-1', 'Bob');

    await rejectsWith(service.addQuestion(roomId, '  what IS   the roadmap? ', 'att-1', 'Bob'), 'DUPLICATE_QUESTION');
  });

  it('reports non-attendees with their own error, not as duplicates', async () => {
    const { roomId } = await createWithAttendee();

    await rejectsWith(service.addQuestion(roomId, 'Hello?', 'stranger', 'Eve'), 'NOT_ATTENDEE');
  });

  it('accepts only one of two concurrent identical questions', async () => {
    const { roomId } = await createWithAttendee();
    await service.joinSession(roomId, { id: 'att-2', name: 'Cy' });

    const results = await Promise.allSettled([
      service.addQuestion(roomId, 'Same question', 'att-1', 'Bob'),
      service.addQuestion(roomId, 'same question', 'att-2', 'Cy'),
    ]);

    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const stored = await SessionModel.findOne({ roomId });
    assert.equal(stored!.questions.length, 1);
  });

  it('toggles votes and keeps the count consistent under concurrent votes', async () => {
    const { roomId } = await createWithAttendee();
    const { question } = await service.addQuestion(roomId, 'Vote on me', 'att-1', 'Bob');
    const questionId = question._id!;

    await Promise.all([
      service.voteQuestion(roomId, questionId, 'att-1'),
      service.voteQuestion(roomId, questionId, 'att-1'),
    ]);

    let stored = (await SessionModel.findOne({ roomId }))!.questions.id(questionId)!;
    assert.equal(stored.upVotes, stored.upVotedBy.length);
    assert.equal(stored.upVotes, 1);

    const { question: toggled } = await service.voteQuestion(roomId, questionId, 'att-1');
    assert.equal(toggled.upVotes, 0);
    assert.deepEqual(toggled.upVotedBy, []);
  });

  it('marks questions answered and highlighted', async () => {
    const { roomId } = await createWithAttendee();
    const { question } = await service.addQuestion(roomId, 'Mark me', 'att-1', 'Bob');

    const answered = await service.markQuestion(roomId, question._id!, 'answered');
    assert.equal(answered.question.answered, true);
    const highlighted = await service.markQuestion(roomId, question._id!, 'highlighted');
    assert.equal(highlighted.question.highlighted, true);

    await rejectsWith(service.markQuestion(roomId, 'not-an-id', 'answered'), 'QUESTION_NOT_FOUND');
  });

  it('blocks every interaction once the session is closed', async () => {
    const { roomId } = await createWithAttendee();
    const { question } = await service.addQuestion(roomId, 'Before close', 'att-1', 'Bob');
    await service.closeSession(roomId);

    await rejectsWith(service.findSession(roomId), 'SESSION_CLOSED');
    await rejectsWith(service.joinSession(roomId, { id: 'att-3', name: 'Dee' }), 'SESSION_CLOSED');
    await rejectsWith(service.addQuestion(roomId, 'After close', 'att-1', 'Bob'), 'SESSION_CLOSED');
    await rejectsWith(service.voteQuestion(roomId, question._id!, 'att-1'), 'SESSION_CLOSED');
    await rejectsWith(service.markQuestion(roomId, question._id!, 'answered'), 'SESSION_CLOSED');
    await rejectsWith(service.closeSession(roomId), 'SESSION_CLOSED');
  });

  it('reports unknown rooms as not found', async () => {
    await rejectsWith(service.findSession('NOPE00'), 'NOT_FOUND');
  });
});
