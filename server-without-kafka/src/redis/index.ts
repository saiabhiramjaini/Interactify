import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
};

const pub = new Redis(redisConfig);
const sub = new Redis(redisConfig);

export { pub, sub };