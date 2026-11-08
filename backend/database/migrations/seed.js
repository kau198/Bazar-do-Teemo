/**
 * Seed — importa os 21 produtos de data/products.json para o banco.
 * Uso: node backend/database/migrations/seed.js
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { up as initial } from "./001_initial.js";
import { query } from "../../src/config/database.js";
import pool from "../../src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// products.json stays in data/ at project root (3 levels up from backend/database/migrations/)
const dataPath = path.resolve(__dirname, "../../../data/products.json");

async function seed() {
  console.log("[Seed] Executando migrations antes do seed...");
  await initial();

  const raw = await readFile(dataPath, "utf-8");
  const { items } = JSON.parse(raw);

  console.log(`[Seed] Importando ${items.length} produtos...`);

  for (const p of items) {
    await query(
      `INSERT INTO products (id, name, description, category, price, currency, image_url, source_url, sizes, tag, art)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         name        = EXCLUDED.name,
         description = EXCLUDED.description,
         category    = EXCLUDED.category,
         price       = EXCLUDED.price,
         currency    = EXCLUDED.currency,
         image_url   = EXCLUDED.image_url,
         source_url  = EXCLUDED.source_url,
         sizes       = EXCLUDED.sizes,
         tag         = EXCLUDED.tag,
         art         = EXCLUDED.art,
         updated_at  = NOW()`,
      [
        p.id,
        p.name,
        p.description ?? "",
        p.category,
        p.price,
        p.currency ?? "BRL",
        p.imageUrl ?? "",
        p.sourceUrl ?? null,
        p.sizes ?? [],
        p.tag ?? "",
        p.art ?? "",
      ]
    );
    console.log(`  ✓ [${p.id}] ${p.name}`);
  }

  console.log("[Seed] Importação concluída.");
}

seed()
  .catch((err) => {
    console.error("[Seed] Erro:", err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
