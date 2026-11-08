/**
 * Runner de migrations — executa todas as migrations em ordem.
 * Uso: node server/migrations/migrate.js
 */
import { up as initial } from "./001_initial.js";
import pool from "../config/database.js";

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
