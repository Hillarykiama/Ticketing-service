import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('1h'),

  DARAJA_CONSUMER_KEY: z.string().min(1, 'DARAJA_CONSUMER_KEY is required'),
  DARAJA_CONSUMER_SECRET: z.string().min(1, 'DARAJA_CONSUMER_SECRET is required'),
  DARAJA_SHORTCODE: z.string().min(1),
  DARAJA_PASSKEY: z.string().min(1),
  DARAJA_CALLBACK_URL: z.string().url('DARAJA_CALLBACK_URL must be a valid URL'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;