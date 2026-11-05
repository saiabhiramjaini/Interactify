import { after, before, beforeEach } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { WebSocket } from 'ws';
import { SessionModel } from '../src/db/models/sessionModel';

// Starts an in-memory MongoDB for the current test file and empties it between tests
export const useTestDatabase = () => {
  let mongo: MongoMemoryServer;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await SessionModel.init(); // Build the unique roomId index
  });

  beforeEach(async () => {
    await SessionModel.deleteMany({});
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
};

// Stands in for a `ws` socket: records everything sent to it
export class FakeSocket {
  readyState = 1; // WebSocket.OPEN
  sent: any[] = [];

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  ofType(type: string) {
    return this.sent.filter((message) => message.type === type);
  }

  last() {
    return this.sent[this.sent.length - 1];
  }

  clear() {
    this.sent = [];
  }

  asSocket() {
    return this as unknown as WebSocket;
  }
}
