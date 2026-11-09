export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    request_key VARCHAR(80) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'demo_confirmed',
    items JSONB NOT NULL,
    address JSONB NOT NULL,
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    shipping_cents INTEGER NOT NULL CHECK (shipping_cents >= 0),
    total_cents INTEGER NOT NULL CHECK (total_cents = subtotal_cents + shipping_cents),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, request_key)
  )`);
  await db.query(
    "CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at)",
  );
}
