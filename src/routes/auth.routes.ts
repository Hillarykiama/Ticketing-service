import { Router } from 'express';
import { z } from 'zod';
import { signup, login } from '../services/auth.service';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['buyer', 'organizer', 'scanner', 'admin']).optional(),
});

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  try {
    const user = await signup(parsed.data.email, parsed.data.password, parsed.data.role);
    res.status(201).json({ user });
  } catch (err: any) {
    if (err.code === '23505') {
      // Postgres unique_violation — email already registered
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err;
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json(result);
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

export default router;