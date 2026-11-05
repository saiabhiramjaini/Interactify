import { SessionModel } from './models/sessionModel';
import { DuplicateKeyError } from '../errors';

export interface WriteResult {
  matched: number;
  modified: number;
}

type Query = { roomId: string } & Record<string, unknown>;

// Every session write goes through a writer. Writes are only considered done once
// they have been applied to MongoDB, so a read straight afterwards sees them.
export interface SessionWriter {
  create(data: { roomId: string } & Record<string, unknown>): Promise<void>;
  updateOne(query: Query, update: Record<string, unknown>): Promise<WriteResult>;
  deleteOne(query: Query): Promise<void>;
}

export const isMongoDuplicateKey = (error: unknown): boolean =>
  (error as { code?: number })?.code === 11000;

export const directWriter: SessionWriter = {
  async create(data) {
    try {
      await SessionModel.create(data);
    } catch (error) {
      if (isMongoDuplicateKey(error)) throw new DuplicateKeyError();
      throw error;
    }
  },

  async updateOne(query, update) {
    const result = await SessionModel.updateOne(query, update);
    return { matched: result.matchedCount, modified: result.modifiedCount };
  },

  async deleteOne(query) {
    await SessionModel.deleteOne(query);
  },
};

let activeWriter: SessionWriter = directWriter;

export const getWriter = (): SessionWriter => activeWriter;

export const setWriter = (writer: SessionWriter): void => {
  activeWriter = writer;
};
