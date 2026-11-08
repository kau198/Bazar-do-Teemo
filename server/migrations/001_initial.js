/**
 * Migration 001 — Criação das tabelas iniciais
 * Executa CREATE TABLE IF NOT EXISTS, portanto é idempotente.
 */
import { query } from "../config/database.js";

export async function up() {
  // ------------------------------------------------------------------
  // Tabela: users
  // ------------------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(150)  NOT NULL,
      email         VARCHAR(254)  NOT NULL UNIQUE,
      password_hash VARCHAR(255)  NOT NULL,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)
  `);

  // ------------------------------------------------------------------
  // Tabela: products
  // ------------------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER      PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      description TEXT         NOT NULL DEFAULT '',
      category    VARCHAR(100) NOT NULL,
      price       NUMERIC(10,2) NOT NULL,
      currency    VARCHAR(10)  NOT NULL DEFAULT 'BRL',
      image_url   TEXT         NOT NULL DEFAULT '',
      source_url  TEXT,
      sizes       TEXT[]       NOT NULL DEFAULT '{}',
      tag         VARCHAR(100) NOT NULL DEFAULT '',
      art         VARCHAR(200) NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS products_category_idx ON products (category)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS products_name_idx ON products USING gin(to_tsvector('portuguese', name || ' ' || description || ' ' || category))
  `);

  // ------------------------------------------------------------------
  // Tabela: sessions (gerenciada por connect-pg-simple)
  // ------------------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid    VARCHAR      NOT NULL COLLATE "default",
      sess   JSON         NOT NULL,
      expire TIMESTAMPTZ  NOT NULL,
      CONSTRAINT sessions_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions (expire)
  `);

  console.log("[Migration 001] Tabelas criadas com sucesso.");
}

export async function down() {
  await query(`DROP TABLE IF EXISTS sessions`);
  await query(`DROP TABLE IF EXISTS products`);
  await query(`DROP TABLE IF EXISTS users`);
  console.log("[Migration 001] Tabelas removidas.");
}
