/**
 * Runner de migrations.
 * Uso: node backend/database/migrations/migrate.js
 */
import { up as initial } from "./001_initial.js";
import pool from "../../src/config/database.js";

async function migrate() {
  console.log("[Migrate] Iniciando migrations...");
  try {
    await initial();
    console.log("[Migrate] Concluído.");
  } catch (err) {
    console.error("[Migrate] Erro:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
