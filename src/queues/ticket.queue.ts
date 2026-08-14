import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const ticketQueue = new Queue('ticket-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

export interface TicketGenerationJob {
  orderId: string;
}