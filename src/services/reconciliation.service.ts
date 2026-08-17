import { pool } from '../config/db';
import { ticketQueue } from '../queues/ticket.queue';
import { logger } from '../utils/logger';
import { invalidateEvent } from './cache.service';

export async function reconcileStuckOrders(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT o.id FROM orders o
    WHERE o.status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id)
  `);

  for (const order of rows) {
    logger.warn({ orderId: order.id }, 'Re-enqueuing stuck paid order with no ticket');
    await ticketQueue.add('generate', { orderId: order.id });
  }

  return rows.length;
}

export async function releaseExpiredReservations(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(`
      SELECT o.id, o.ticket_type_id, o.quantity, tt.event_id
      FROM orders o
      JOIN ticket_types tt ON tt.id = o.ticket_type_id
      WHERE o.status = 'pending_payment' AND o.expires_at < now()
      FOR UPDATE OF o
    `);

    for (const row of rows) {
      await client.query(
        `UPDATE ticket_types SET available_quantity = available_quantity + $1 WHERE id = $2`,
        [row.quantity, row.ticket_type_id]
      );
      await client.query(`UPDATE orders SET status = 'expired' WHERE id = $1`, [row.id]);
      logger.info({ orderId: row.id }, 'Released expired reservation, inventory restored');
    }

    await client.query('COMMIT');

    // Invalidate cache for any affected events, outside the transaction
    const uniqueEventIds = [...new Set(rows.map((r) => r.event_id))];
    await Promise.all(uniqueEventIds.map((id) => invalidateEvent(id)));

    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Failed to release expired reservations');
    throw err;
  } finally {
    client.release();
  }
}