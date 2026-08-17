import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/config/db';
import { reserveTicket } from '../src/services/inventory.service';

describe('sharded reservation concurrency', () => {
  let eventId: string;
  let ticketTypeId: string;
  const userId = '00000000-0000-0000-0000-000000000002';
  const SHARD_COUNT = 10;
  const PER_SHARD = 2;
  const TOTAL_TICKETS = SHARD_COUNT * PER_SHARD; // 20

  beforeAll(async () => {
    const { rows: eventRows } = await pool.query(
      `INSERT INTO events (organizer_id, name, starts_at, status)
       VALUES (gen_random_uuid(), 'Sharding Test Event', now() + interval '1 day', 'published')
       RETURNING id`
    );
    eventId = eventRows[0].id;

    const { rows: ttRows } = await pool.query(
      `INSERT INTO ticket_types (event_id, name, price_cents)
       VALUES ($1, 'Sharded Test Ticket', 1000)
       RETURNING id`,
      [eventId]
    );
    ticketTypeId = ttRows[0].id;

    await pool.query(
      `INSERT INTO ticket_type_shards (ticket_type_id, shard_index, total_quantity, available_quantity)
       SELECT $1, i, $2, $2 FROM generate_series(0, $3) AS i`,
      [ticketTypeId, PER_SHARD, SHARD_COUNT - 1]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM orders WHERE ticket_type_id = $1`, [ticketTypeId]);
    await pool.query(`DELETE FROM ticket_type_shards WHERE ticket_type_id = $1`, [ticketTypeId]);
    await pool.query(`DELETE FROM ticket_types WHERE id = $1`, [ticketTypeId]);
    await pool.query(`DELETE FROM events WHERE id = $1`, [eventId]);
    await pool.end();
  });

  it('handles 40 concurrent requests for 20 tickets: exactly 20 succeed, 20 fail, never oversells', async () => {
    const CONCURRENT_REQUESTS = 40; // double the available tickets

    const attempts = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      reserveTicket(ticketTypeId, userId, 1)
    );

    const results = await Promise.allSettled(attempts);
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(TOTAL_TICKETS);
    expect(failed.length).toBe(CONCURRENT_REQUESTS - TOTAL_TICKETS);

    const { rows } = await pool.query(
      `SELECT SUM(available_quantity) AS total FROM ticket_type_shards WHERE ticket_type_id = $1`,
      [ticketTypeId]
    );
    expect(Number(rows[0].total)).toBe(0);
  });
});