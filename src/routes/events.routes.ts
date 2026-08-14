import { Router } from 'express';
import { pool } from '../config/db';
import { getCachedEvent, setCachedEvent } from '../services/cache.service';

const router = Router();

router.get('/events/:id', async (req, res) => {
  const { id } = req.params;

  const cached = await getCachedEvent(id);
  if (cached) {
    return res.json({ event: cached, cached: true });
  }

  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.starts_at, e.status,
            json_agg(json_build_object(
              'id', tt.id, 'name', tt.name, 'price_cents', tt.price_cents,
              'available_quantity', tt.available_quantity
            )) AS ticket_types
     FROM events e
     LEFT JOIN ticket_types tt ON tt.event_id = e.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const event = rows[0];
  await setCachedEvent(id, event);

  res.json({ event, cached: false });
});

export default router;