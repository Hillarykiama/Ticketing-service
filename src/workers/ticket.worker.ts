import { Worker, Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { redisConnection } from '../config/redis';
import { pool } from '../config/db';
import { TicketGenerationJob } from '../queues/ticket.queue';

const worker = new Worker<TicketGenerationJob>(
  'ticket-generation',
  async (job: Job<TicketGenerationJob>) => {
    const { orderId } = job.data;
    console.log(`[worker] Processing job ${job.id} for order ${orderId} (attempt ${job.attemptsMade + 1})`);

    // Idempotency guard: if a ticket already exists for this order
    // (e.g. a retried job after a partial earlier success), don't create a duplicate
    const existing = await pool.query(`SELECT id FROM tickets WHERE order_id = $1`, [orderId]);
    if (existing.rows.length > 0) {
      console.log(`[worker] Ticket already exists for order ${orderId}, skipping`);
      return;
    }

    const qrCode = `TICKET-${orderId}-${randomUUID().slice(0, 8)}`;

    await pool.query(
      `INSERT INTO tickets (order_id, qr_code) VALUES ($1, $2)`,
      [orderId, qrCode]
    );

    console.log(`[worker] Ticket generated for order ${orderId}: ${qrCode}`);
  },
  { connection: redisConnection }
);

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

console.log('Ticket generation worker started, listening for jobs...');