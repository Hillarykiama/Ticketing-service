import { Router } from 'express';
import { pool } from '../config/db';
import { ticketQueue } from '../queues/ticket.queue';
import { logger } from '../utils/logger';

const router = Router();

router.post('/mpesa', async (req, res) => {
  const body = req.body;
  const stkCallback = body?.Body?.stkCallback;

  if (!stkCallback) {
    return res.status(400).json({ error: 'Malformed callback payload' });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
  const log = logger.child({ checkoutRequestId: CheckoutRequestID });

  const inserted = await pool.query(
    `INSERT INTO webhook_events (provider, event_id, payload)
     VALUES ('mpesa', $1, $2)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING id`,
    [CheckoutRequestID, body]
  );

  if (inserted.rowCount === 0) {
    log.info('Duplicate webhook received, ignoring');
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }

  log.info({ resultCode: ResultCode, resultDesc: ResultDesc }, 'M-Pesa callback received');

  const client = await pool.connect();
  let paidOrderId: string | null = null;

  try {
    await client.query('BEGIN');

    const newStatus = ResultCode === 0 ? 'paid' : 'cancelled';

    const { rows, rowCount } = await client.query(
      `UPDATE orders SET status = $1 WHERE payment_ref = $2 AND status = 'pending_payment' RETURNING id`,
      [newStatus, CheckoutRequestID]
    );

    if (rowCount === 0) {
      log.warn('No matching pending order found for this callback');
    } else {
      log.info({ orderId: rows[0].id, newStatus }, 'Order status updated');
      if (newStatus === 'paid') {
        paidOrderId = rows[0].id;
      }
    }

    await client.query(
      `UPDATE webhook_events SET processed_at = now() WHERE provider = 'mpesa' AND event_id = $1`,
      [CheckoutRequestID]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    log.error({ err }, 'Failed to process webhook, rolled back');
    throw err;
  } finally {
    client.release();
  }

  if (paidOrderId) {
    await ticketQueue.add('generate', { orderId: paidOrderId });
    log.info({ orderId: paidOrderId }, 'Enqueued ticket generation');
  }

  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export default router;