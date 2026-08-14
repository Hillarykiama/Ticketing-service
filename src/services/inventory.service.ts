import { pool } from '../config/db';
import { invalidateEvent } from './cache.service';

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

const RESERVATION_TTL_MINUTES = 10;

export async function reserveTicket(ticketTypeId: string, userId: string, quantity: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT tt.available_quantity, tt.event_id
       FROM ticket_types tt WHERE tt.id = $1 FOR UPDATE`,
      [ticketTypeId]
    );

    if (!rows.length) {
      throw new NotFoundError('Ticket type not found');
    }

    if (rows[0].available_quantity < quantity) {
      throw new ConflictError('Not enough tickets available');
    }

    await client.query(
      `UPDATE ticket_types SET available_quantity = available_quantity - $1 WHERE id = $2`,
      [quantity, ticketTypeId]
    );

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (user_id, ticket_type_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, 'pending_payment', now() + interval '${RESERVATION_TTL_MINUTES} minutes')
       RETURNING *`,
      [userId, ticketTypeId, quantity]
    );

    await client.query('COMMIT');

    // Invalidate outside the transaction — cache correctness doesn't need
    // to be atomic with the DB write, just eventually consistent within ms
    await invalidateEvent(rows[0].event_id);

    return orderRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}