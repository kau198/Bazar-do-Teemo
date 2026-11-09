/**
 * Runner de migrations.
 * Uso: node backend/database/migrations/migrate.js
 */
import { up as initial } from "./001_initial.js";
import pool from "../../src/config/database.js";
import { up as orders } from "./002_orders.js";

async function migrate() {
  console.log("[Migrate] Iniciando migrations...");
  try {
    await initial();
    await orders(pool);
    console.log("[Migrate] Concluído.");
  } catch (err) {
    console.error("[Migrate] Erro:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
