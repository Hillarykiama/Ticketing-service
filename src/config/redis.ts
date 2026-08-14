import IORedis from 'ioredis';
import { env } from './env';

// General-purpose client: caching, rate limiting
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('Redis client error:', err);
});

// BullMQ requires maxRetriesPerRequest: null on its dedicated connection —
// it manages its own retry/reconnect behavior internally
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (err) {
    console.error('Redis health check failed:', err);
    return false;
  }
}