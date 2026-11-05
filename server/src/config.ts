import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const list = (value: string | undefined): string[] =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const defaultKafkaBroker = `${process.env.PRIVATE_IP || 'localhost'}:9092`;

export const config = {
  port: Number(process.env.PORT) || 8080,
  serverId: process.env.SERVER_ID || 'server-1',
  // Unique per process, so a server can recognise its own Redis publications
  // even when several instances share the same SERVER_ID.
  instanceId: randomUUID(),
  mongoUri: process.env.MONGO_URI || '',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  // Empty means "accept WebSocket connections from any origin".
  allowedOrigins: list(process.env.ALLOWED_ORIGINS),
  enableKafka: process.env.ENABLE_KAFKA === 'true',
  kafkaBrokers: list(process.env.KAFKA_BROKERS).length
    ? list(process.env.KAFKA_BROKERS)
    : [defaultKafkaBroker],
};
