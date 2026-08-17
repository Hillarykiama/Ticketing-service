import { pool } from '../config/db';
import { invalidateEvent } from './cache.service';

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

const RESERVATION_TTL_MINUTES = 10;
const MAX_SHARD_ATTEMPTS = 5; // how many different shards to try before giving up

export async function reserveTicket(ticketTypeId: string, userId: string, quantity: number) {
  const { rows: shardRows } = await pool.query(
    `SELECT id FROM ticket_type_shards WHERE ticket_type_id = $1`,
    [ticketTypeId]
  );

  if (!shardRows.length) {
    throw new NotFoundError('Ticket type not found or not sharded');
  }

  // Shuffle shard order so concurrent buyers don't all pile onto shard 0 first —
  // spreading initial attempts evenly is what actually reduces contention
  const shuffledShardIds = shardRows.map((r) => r.id).sort(() => Math.random() - 0.5);

  let lastError: Error = new ConflictError('Not enough tickets available');

  for (const shardId of shuffledShardIds.slice(0, MAX_SHARD_ATTEMPTS)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT available_quantity, ticket_type_id FROM ticket_type_shards WHERE id = $1 FOR UPDATE`,
        [shardId]
      );

      if (!rows.length || rows[0].available_quantity < quantity) {
        await client.query('ROLLBACK');
        continue; // this shard is full or gone, try the next one
      }

      await client.query(
        `UPDATE ticket_type_shards SET available_quantity = available_quantity - $1 WHERE id = $2`,
        [quantity, shardId]
      );

      const { rows: eventRows } = await client.query(
        `SELECT event_id FROM ticket_types WHERE id = $1`,
        [ticketTypeId]
      );

      const { rows: orderRows } = await client.query(
        `INSERT INTO orders (user_id, ticket_type_id, shard_id, quantity, status, expires_at)
         VALUES ($1, $2, $3, $4, 'pending_payment', now() + interval '${RESERVATION_TTL_MINUTES} minutes')
         RETURNING *`,
        [userId, ticketTypeId, shardId, quantity]
      );

      await client.query('COMMIT');
      await invalidateEvent(eventRows[0].event_id);

      return orderRows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      lastError = err as Error;
    } finally {
      client.release();
    }
  }

  throw lastError;
}