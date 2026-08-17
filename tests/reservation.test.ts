import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/config/db';
import { reserveTicket, ConflictError } from '../src/services/inventory.service';

describe('reserveTicket concurrency', () => {
  let eventId: string;
  let ticketTypeId: string;
  const userId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const { rows: eventRows } = await pool.query(
      `INSERT INTO events (organizer_id, name, starts_at, status)
       VALUES (gen_random_uuid(), 'Concurrency Test Event', now() + interval '1 day', 'published')
       RETURNING id`
    );
    eventId = eventRows[0].id;

    const { rows: ttRows } = await pool.query(
      `INSERT INTO ticket_types (event_id, name, price_cents, total_quantity, available_quantity)
       VALUES ($1, 'Test Ticket', 1000, 1, 1)
       RETURNING id`,
      [eventId]
    );
    ticketTypeId = ttRows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM orders WHERE ticket_type_id = $1`, [ticketTypeId]);
    await pool.query(`DELETE FROM ticket_types WHERE id = $1`, [ticketTypeId]);
    await pool.query(`DELETE FROM events WHERE id = $1`, [eventId]);
    await pool.end();
  });

  it('only allows ONE of two concurrent requests to succeed when only 1 ticket is available', async () => {
    // Fire both requests at the same time — this is the real test of the
    // row-lock: without it, both could read available_quantity=1 before
    // either writes, and both would succeed (overselling)
    const results = await Promise.allSettled([
      reserveTicket(ticketTypeId, userId, 1),
      reserveTicket(ticketTypeId, userId, 1),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    // Confirm final inventory state is exactly 0, not negative
    const { rows } = await pool.query(
      `SELECT available_quantity FROM ticket_types WHERE id = $1`,
      [ticketTypeId]
    );
    expect(rows[0].available_quantity).toBe(0);
  });
});