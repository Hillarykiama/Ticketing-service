import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { checkDbConnection } from './config/db';
import { checkRedisConnection } from './config/redis';
import authRoutes from './routes/auth.routes';
import ordersRoutes from './routes/orders.routes';

const app = express();

app.use(helmet());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([checkDbConnection(), checkRedisConnection()]);
  const healthy = dbOk && redisOk;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    db: dbOk ? 'up' : 'down',
    redis: redisOk ? 'up' : 'down',
  });
});

app.use('/auth', authRoutes);
app.use('/', ordersRoutes);

app.listen(Number(env.PORT), () => {
  console.log(`ticketing-service listening on port ${env.PORT}`);
});