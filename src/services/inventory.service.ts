import { pool } from '../config/db';

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

const RESERVATION_TTL_MINUTES = 10;

export async function reserveTicket(ticketTypeId: string, userId: string, quantity: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the row so a concurrent request for the same ticket type
    // waits instead of racing on the same available_quantity value
    const { rows } = await client.query(
      `SELECT available_quantity FROM ticket_types WHERE id = $1 FOR UPDATE`,
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
    return orderRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}