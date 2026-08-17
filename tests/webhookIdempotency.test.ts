import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '../src/config/db';

describe('webhook_events idempotency constraint', () => {
  const provider = 'test-provider';
  const eventId = `test-event-${Date.now()}`;

  afterAll(async () => {
    await pool.query(`DELETE FROM webhook_events WHERE provider = $1 AND event_id = $2`, [
      provider,
      eventId,
    ]);
    await pool.end();
  });

  it('only inserts the first of two identical (provider, event_id) webhook deliveries', async () => {
    const payload = { some: 'data' };

    const first = await pool.query(
      `INSERT INTO webhook_events (provider, event_id, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [provider, eventId, payload]
    );

    const second = await pool.query(
      `INSERT INTO webhook_events (provider, event_id, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [provider, eventId, payload]
    );

    expect(first.rowCount).toBe(1); // first delivery: inserted
    expect(second.rowCount).toBe(0); // duplicate delivery: no-op, exactly as our webhook handler relies on

    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM webhook_events WHERE provider = $1 AND event_id = $2`,
      [provider, eventId]
    );
    expect(Number(rows[0].count)).toBe(1); // exactly one row exists, not two
  });
});