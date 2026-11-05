import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSocket, useTestDatabase } from './helpers';
import { handleRawMessage, handleSocketClosed } from '../src/ws';
import { websocketService } from '../src/ws/services/websocketService';
import { pubSubService } from '../src/redis/pubSubService';
import { SessionModel } from '../src/db/models/sessionModel';

useTestDatabase();

const published = mock.method(pubSubService, 'publishToRoom', () => {});

const connect = () => {
  const socket = new FakeSocket();
  websocketService.addClient(socket.asSocket());
  return socket;
};

const send = (socket: FakeSocket, type: string, payload: unknown) =>
  handleRawMessage(socket.asSocket(), JSON.stringify({ type, payload }));

// Creates a session and joins a presenter socket and one attendee socket
const setupRoom = async () => {
  const presenter = connect();
  await send(presenter, 'create', { sessionName: 'Demo', owner: 'Ada' });
  const { session, ownerToken } = presenter.ofType('sessionCreated')[0].payload;
  await send(presenter, 'join', { roomId: session.roomId, ownerToken });

  const attendee = connect();
  await send(attendee, 'join', { roomId: session.roomId, attendee: { id: 'att-1', name: 'Bob' } });

  presenter.clear();
  attendee.clear();
  return { roomId: session.roomId as string, ownerToken: ownerToken as string, presenter, attendee };
};

describe('message handlers', () => {
  beforeEach(() => {
    websocketService.getClients().splice(0);
    published.mock.resetCalls();
  });

  it('delivers a broadcast to each local client exactly once and publishes it once', async () => {
    const { roomId, presenter, attendee } = await setupRoom();
    published.mock.resetCalls();

    await send(attendee, 'question', { roomId, questionText: 'Hello?' });

    assert.equal(presenter.ofType('questionAdded').length, 1);
    assert.equal(attendee.ofType('questionAdded').length, 1);
    assert.equal(published.mock.callCount(), 1);
  });

  it('announces an attendee once, not again when they rejoin', async () => {
    const { roomId, presenter, attendee } = await setupRoom();

    await send(attendee, 'join', { roomId, attendee: { id: 'att-1', name: 'Bob' } });

    assert.equal(attendee.last().type, 'sessionJoined');
    assert.equal(presenter.ofType('attendeeJoined').length, 0);
  });

  it('rejects presenter actions from anyone who only knows the presenter name', async () => {
    const { roomId, attendee } = await setupRoom();

    await send(attendee, 'join', { roomId, ownerToken: 'Ada' });
    assert.equal(attendee.last().payload.code, 'FORBIDDEN');

    await send(attendee, 'close', { roomId, ownerId: 'Ada' });
    assert.equal(attendee.last().payload.code, 'FORBIDDEN');

    const stored = await SessionModel.findOne({ roomId });
    assert.equal(stored!.sessionStatus, 'active');
  });

  it('lets the verified presenter mark questions and close the session', async () => {
    const { roomId, presenter, attendee } = await setupRoom();
    await send(attendee, 'question', { roomId, questionText: 'Mark me' });
    const questionId = attendee.ofType('questionAdded')[0].payload.question._id;

    await send(presenter, 'markQuestion', { roomId, questionId, action: 'answered' });
    assert.equal(attendee.ofType('questionUpdated')[0].payload.question.answered, true);

    await send(presenter, 'close', { roomId });
    assert.equal(presenter.ofType('sessionClosed').length, 1);
    assert.equal(attendee.ofType('sessionClosed').length, 1);
    assert.equal((await SessionModel.findOne({ roomId }))!.sessionStatus, 'closed');
  });

  it('acts on the identity bound at join, not ids in the payload', async () => {
    const { roomId, attendee } = await setupRoom();

    await send(attendee, 'question', { roomId, questionText: 'Who am I?', authorId: 'someone-else', authorName: 'Mallory' });
    const { question } = attendee.ofType('questionAdded')[0].payload;
    assert.equal(question.authorId, 'att-1');
    assert.equal(question.authorName, 'Bob');

    await send(attendee, 'vote', { roomId, questionId: question._id, voterId: 'someone-else' });
    assert.deepEqual(attendee.ofType('questionUpdated')[0].payload.question.upVotedBy, ['att-1']);
  });

  it('requires joining before asking or voting', async () => {
    const { roomId } = await setupRoom();
    const outsider = connect();

    await send(outsider, 'question', { roomId, questionText: 'Sneaky' });
    assert.equal(outsider.last().payload.code, 'NOT_IN_SESSION');
  });

  it('tells the room when an attendee leaves explicitly', async () => {
    const { roomId, presenter, attendee } = await setupRoom();

    await send(attendee, 'leave', { roomId });

    const [left] = presenter.ofType('attendeeLeft');
    assert.equal(left.payload.attendee.id, 'att-1');
    assert.deepEqual(left.payload.attendees, []);
    assert.equal(attendee.last().type, 'success');
  });

  it('removes an attendee when their socket disconnects, but not while another tab is open', async () => {
    const { roomId, presenter, attendee } = await setupRoom();
    const secondTab = connect();
    await send(secondTab, 'join', { roomId, attendee: { id: 'att-1', name: 'Bob' } });

    await handleSocketClosed(attendee.asSocket());
    assert.equal(presenter.ofType('attendeeLeft').length, 0);

    await handleSocketClosed(secondTab.asSocket());
    assert.equal(presenter.ofType('attendeeLeft').length, 1);
  });

  it('normalizes room codes and explains closed sessions', async () => {
    const { roomId, presenter } = await setupRoom();
    const latecomer = connect();

    await send(latecomer, 'getSession', { roomId: roomId.toLowerCase() });
    assert.equal(latecomer.last().type, 'sessionData');

    await send(presenter, 'close', { roomId });
    await send(latecomer, 'join', { roomId, attendee: { id: 'att-9', name: 'Late' } });
    assert.equal(latecomer.last().payload.code, 'SESSION_CLOSED');
  });

  it('answers malformed and unknown messages with an error', async () => {
    const socket = connect();

    await handleRawMessage(socket.asSocket(), 'not json');
    assert.equal(socket.last().payload.message, 'Invalid message format');

    await send(socket, 'explode', {});
    assert.equal(socket.last().payload.message, 'Unknown message type');
  });
});
