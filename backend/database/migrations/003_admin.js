/** Existing catalog remains unlimited until an administrator sets a stock count. */
export async function up(db) {
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'customer'");
  await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE");
  await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER CHECK (stock >= 0)");
  await db.query("CREATE SEQUENCE IF NOT EXISTS admin_product_ids START WITH 1000000");
}
