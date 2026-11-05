import Redis from 'ioredis';
import { config } from '../config';

// lazyConnect: nothing connects on import; connectRedis() is called during startup.
const redisConfig = { ...config.redis, lazyConnect: true };

const pub = new Redis(redisConfig);
const sub = new Redis(redisConfig);

const connectRedis = async (): Promise<void> => {
  await Promise.all([pub.connect(), sub.connect()]);
};

export { pub, sub, connectRedis };
