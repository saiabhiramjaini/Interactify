import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSocket } from './helpers';
import { config } from '../src/config';
import { pubSubService } from '../src/redis/pubSubService';
import { websocketService } from '../src/ws/services/websocketService';
import { KafkaWriter, DbOperation } from '../src/kafka/kafkaWriter';
import { DuplicateKeyError, SessionError } from '../src/errors';

const envelope = (instanceId: string, payload: unknown) =>
  JSON.stringify({ payload, timestamp: Date.now(), serverId: 'any', instanceId });

describe('Redis room relay', () => {
  it('ignores its own publications and delivers other instances\' messages', () => {
    const socket = new FakeSocket();
    websocketService.addClient(socket.asSocket());
    websocketService.updateClientRoom(socket.asSocket(), 'ROOM01', 'attendee', { id: 'a', name: 'A' });

    pubSubService.handleRoomMessage('room:ROOM01', envelope(config.instanceId, { type: 'questionAdded' }));
    assert.equal(socket.sent.length, 0);

    pubSubService.handleRoomMessage('room:ROOM01', envelope('other-instance', { type: 'questionAdded' }));
    assert.equal(socket.ofType('questionAdded').length, 1);

    pubSubService.handleRoomMessage('room:ROOM01', envelope('other-instance', { type: 'sessionClosed' }));
    assert.equal(websocketService.getClientBySocket(socket.asSocket())!.roomId, undefined);

    websocketService.removeClient(socket.asSocket());
  });
});

describe('KafkaWriter', () => {
  it('keys operations by room and resolves with the consumer\'s result', async () => {
    const sent: DbOperation[] = [];
    const writer: KafkaWriter = new KafkaWriter(async (op) => {
      sent.push(op);
      setImmediate(() => writer.handleAck({ opId: op.opId, ok: true, result: { matched: 1, modified: 1 } }));
    });

    const result = await writer.updateOne({ roomId: 'ROOM01' }, { $set: { sessionStatus: 'closed' } });

    assert.deepEqual(result, { matched: 1, modified: 1 });
    assert.equal(sent[0].key, 'ROOM01');
  });

  it('surfaces duplicate keys so room code collisions can be retried', async () => {
    const writer: KafkaWriter = new KafkaWriter(async (op) => {
      setImmediate(() => writer.handleAck({ opId: op.opId, ok: false, error: { message: 'dup', duplicateKey: true } }));
    });

    await assert.rejects(writer.create({ roomId: 'ROOM01' }), DuplicateKeyError);
  });

  it('times out when no acknowledgement arrives', async () => {
    const writer = new KafkaWriter(async () => {}, 20);

    await assert.rejects(
      writer.deleteOne({ roomId: 'ROOM01' }),
      (error: unknown) => error instanceof SessionError && error.code === 'WRITE_FAILED'
    );
  });

  it('ignores acknowledgements for operations it did not produce', () => {
    const writer = new KafkaWriter(async () => {});
    assert.doesNotThrow(() => writer.handleAck({ opId: 'from-another-instance', ok: true }));
  });
});
