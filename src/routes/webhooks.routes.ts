import { Router } from 'express';
import { pool } from '../config/db';

const router = Router();

router.post('/mpesa', async (req, res) => {
  const body = req.body;
  const stkCallback = body?.Body?.stkCallback;

  if (!stkCallback) {
    return res.status(400).json({ error: 'Malformed callback payload' });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

  const inserted = await pool.query(
    `INSERT INTO webhook_events (provider, event_id, payload)
     VALUES ('mpesa', $1, $2)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING id`,
    [CheckoutRequestID, body]
  );

  if (inserted.rowCount === 0) {
    console.log('Duplicate webhook received, ignoring:', CheckoutRequestID);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }

  console.log('M-Pesa callback received:', { CheckoutRequestID, ResultCode, ResultDesc });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const newStatus = ResultCode === 0 ? 'paid' : 'cancelled';

    const { rowCount } = await client.query(
      `UPDATE orders SET status = $1 WHERE payment_ref = $2 AND status = 'pending_payment'`,
      [newStatus, CheckoutRequestID]
    );

    if (rowCount === 0) {
      console.warn('No matching pending order found for', CheckoutRequestID);
    } else {
      console.log(`Order for ${CheckoutRequestID} marked as ${newStatus}`);
    }

    await client.query(
      `UPDATE webhook_events SET processed_at = now() WHERE provider = 'mpesa' AND event_id = $1`,
      [CheckoutRequestID]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export default router;