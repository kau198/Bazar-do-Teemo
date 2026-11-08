import bcrypt from "bcryptjs";
import { query } from "../config/database.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../utils/errors.js";

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 10;
const loginAttempts = new Map();

export async function registerUser({ name, email, password }) {
  if (!name?.trim() || !email?.trim() || !password) {
    throw new ValidationError("Campos obrigatórios ausentes.");
  }
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail]);
  if (existing.rows.length) throw new ConflictError("Este e-mail já está cadastrado.");

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name.trim(), normalizedEmail, password_hash]
  );
  return rows[0];
}

export async function loginUser({ email, password, ip }) {
  const key = ip || "unknown";
  const attempts = loginAttempts.get(key) || { count: 0, until: 0 };

  if (Date.now() < attempts.until) {
    throw new UnauthorizedError("Muitas tentativas. Aguarde antes de tentar novamente.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { rows } = await query(
    `SELECT id, name, email, password_hash FROM users WHERE email = $1`,
    [normalizedEmail]
  );

  const user = rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!valid) {
    attempts.count += 1;
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.until = Date.now() + 15 * 60 * 1000;
      attempts.count = 0;
    }
    loginAttempts.set(key, attempts);
    throw new UnauthorizedError("E-mail ou senha incorretos.");
  }

  loginAttempts.delete(key);
  return { id: user.id, name: user.name, email: user.email };
}

export async function getUserById(id) {
  const { rows } = await query(
    `SELECT id, name, email, created_at FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}
