import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { env } from '../config/env';

const SALT_ROUNDS = 10;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export async function signup(email: string, password: string, role = 'buyer'): Promise<AuthUser> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role`,
    [email, passwordHash, role]
  );

  return rows[0];
}

export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, email, role, password_hash FROM users WHERE email = $1`,
    [email]
  );

  if (!rows.length) return null; // don't reveal whether the email exists

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  return { user: { id: user.id, email: user.email, role: user.role }, token };
}