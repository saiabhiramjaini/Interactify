import { randomUUID } from 'crypto';
import { SessionWriter, WriteResult, directWriter } from '../db/writer';
import { DuplicateKeyError, SessionError } from '../errors';

export const DB_OPS_TOPIC = 'db-operations';
export const DB_ACK_CHANNEL = 'db-operations:ack';

export interface DbOperation {
  opId: string;
  type: 'create' | 'update' | 'delete';
  // Kafka message key. Using the roomId keeps every write for a room on one
  // partition, so they are applied in the order they were produced.
  key: string;
  query?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface DbAck {
  opId: string;
  ok: boolean;
  result?: WriteResult;
  error?: { message: string; duplicateKey?: boolean };
}

interface Pending {
  resolve: (result: WriteResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

// Applies one operation to MongoDB. Runs on whichever server consumes the message.
export const applyDbOperation = async (op: DbOperation): Promise<DbAck> => {
  try {
    let result: WriteResult = { matched: 0, modified: 0 };
    switch (op.type) {
      case 'create':
        await directWriter.create(op.data as { roomId: string });
        result = { matched: 1, modified: 1 };
        break;
      case 'update':
        result = await directWriter.updateOne(op.query as { roomId: string }, op.data || {});
        break;
      case 'delete':
        await directWriter.deleteOne(op.query as { roomId: string });
        break;
      default:
        throw new Error(`Unknown operation type: ${(op as DbOperation).type}`);
    }
    return { opId: op.opId, ok: true, result };
  } catch (error) {
    return {
      opId: op.opId,
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        duplicateKey: error instanceof DuplicateKeyError,
      },
    };
  }
};

// Produces writes to Kafka and waits for the consumer's acknowledgement (relayed over
// Redis, since the consumer may be another server instance) before resolving.
export class KafkaWriter implements SessionWriter {
  private pending = new Map<string, Pending>();

  constructor(
    private readonly send: (op: DbOperation) => Promise<void>,
    private readonly timeoutMs = 10000
  ) {}

  async create(data: { roomId: string } & Record<string, unknown>): Promise<void> {
    await this.execute({ type: 'create', key: data.roomId, data });
  }

  updateOne(query: { roomId: string } & Record<string, unknown>, update: Record<string, unknown>) {
    return this.execute({ type: 'update', key: query.roomId, query, data: update });
  }

  async deleteOne(query: { roomId: string } & Record<string, unknown>): Promise<void> {
    await this.execute({ type: 'delete', key: query.roomId, query });
  }

  handleAck(ack: DbAck): void {
    const pending = this.pending.get(ack.opId);
    if (!pending) return; // Produced by another server instance.

    clearTimeout(pending.timer);
    this.pending.delete(ack.opId);

    if (ack.ok) {
      pending.resolve(ack.result || { matched: 0, modified: 0 });
    } else if (ack.error?.duplicateKey) {
      pending.reject(new DuplicateKeyError(ack.error.message));
    } else {
      pending.reject(new Error(ack.error?.message || 'Database operation failed'));
    }
  }

  rejectAll(reason: Error): void {
    this.pending.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(reason);
    });
    this.pending.clear();
  }

  private execute(op: Omit<DbOperation, 'opId'>): Promise<WriteResult> {
    const opId = randomUUID();

    return new Promise<WriteResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(opId);
        reject(new SessionError('WRITE_FAILED', 'Timed out waiting for the database. Please try again.'));
      }, this.timeoutMs);

      this.pending.set(opId, { resolve, reject, timer });

      this.send({ ...op, opId }).catch((error) => {
        clearTimeout(timer);
        this.pending.delete(opId);
        reject(error);
      });
    });
  }
}
