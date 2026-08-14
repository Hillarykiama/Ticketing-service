import { redis } from '../config/redis';

const EVENT_TTL_SECONDS = 30; // short TTL — availability changes frequently

export async function getCachedEvent(eventId: string): Promise<any | null> {
  const cached = await redis.get(`event:${eventId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedEvent(eventId: string, data: unknown): Promise<void> {
  await redis.set(`event:${eventId}`, JSON.stringify(data), 'EX', EVENT_TTL_SECONDS);
}

export async function invalidateEvent(eventId: string): Promise<void> {
  await redis.del(`event:${eventId}`);
}