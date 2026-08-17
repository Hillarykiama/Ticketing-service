import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { checkDbConnection } from './config/db';
import { checkRedisConnection } from './config/redis';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';
import { ticketQueue } from './queues/ticket.queue';
import authRoutes from './routes/auth.routes';
import ordersRoutes from './routes/orders.routes';
import webhooksRoutes from './routes/webhooks.routes';
import paymentsRoutes from './routes/payments.routes';
import eventsRoutes from './routes/events.routes';

const app = express();

app.use(requestLogger);
app.use(helmet());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const [dbOk, redisOk, queueCounts] = await Promise.all([
    checkDbConnection(),
    checkRedisConnection(),
    ticketQueue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
  ]);

  const healthy = dbOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    db: dbOk ? 'up' : 'down',
    redis: redisOk ? 'up' : 'down',
    queues: {
      ticketGeneration: queueCounts,
    },
  });
});

app.use('/auth', authRoutes);
app.use('/', ordersRoutes);
app.use('/webhooks', webhooksRoutes);
app.use('/', paymentsRoutes);
app.use('/', eventsRoutes);

app.listen(Number(env.PORT), () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'ticketing-service listening');
});