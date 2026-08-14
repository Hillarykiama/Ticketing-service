import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { reserveTicket, NotFoundError, ConflictError } from '../services/inventory.service';

const router = Router();

const reserveSchema = z.object({
  ticketTypeId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

// Max 5 reservation attempts per IP per minute — generous enough for real
// users retrying a failed purchase, tight enough to blunt bot sniping
router.post('/orders', rateLimit(60, 5), requireAuth, async (req: AuthedRequest, res) => {
  const parsed = reserveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  try {
    const order = await reserveTicket(parsed.data.ticketTypeId, req.user!.id, parsed.data.quantity);
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof ConflictError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

export default router;