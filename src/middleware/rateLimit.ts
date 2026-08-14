import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

export function rateLimit(windowSeconds: number, maxRequests: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${req.ip}:${req.baseUrl}${req.path}`;

    const current = await redis.incr(key);
    if (current === 1) {
      // First request in this window — set the window to expire
      await redis.expire(key, windowSeconds);
    }

    if (current > maxRequests) {
      const ttl = await redis.ttl(key);
      res.set('Retry-After', String(ttl > 0 ? ttl : windowSeconds));
      return res.status(429).json({ error: 'Too many requests, please slow down' });
    }

    next();
  };
}