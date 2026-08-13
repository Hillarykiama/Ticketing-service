import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { initiateStkPush } from '../services/daraja.service';

const router = Router();

const payForOrderSchema = z.object({
  orderId: z.string().uuid(),
  phoneNumber: z.string().regex(/^254\d{9}$/, 'Phone must be in format 2547XXXXXXXX'),
});

router.post('/pay', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = payForOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  const { orderId, phoneNumber } = parsed.data;

  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.quantity, tt.price_cents
     FROM orders o JOIN ticket_types tt ON tt.id = o.ticket_type_id
     WHERE o.id = $1 AND o.user_id = $2`,
    [orderId, req.user!.id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = rows[0];
  if (order.status !== 'pending_payment') {
    return res.status(409).json({ error: `Order is not payable (status: ${order.status})` });
  }

  const amount = Math.round((order.price_cents * order.quantity) / 100); // Daraja sandbox wants whole KES units

  const stkResult = await initiateStkPush({
    phoneNumber,
    amount,
    accountReference: orderId,
    transactionDesc: `Ticket order ${orderId}`,
  });

  await pool.query(`UPDATE orders SET payment_ref = $1 WHERE id = $2`, [
    stkResult.CheckoutRequestID,
    orderId,
  ]);

  res.json({ checkoutRequestId: stkResult.CheckoutRequestID, stkResult });
});

export default router;