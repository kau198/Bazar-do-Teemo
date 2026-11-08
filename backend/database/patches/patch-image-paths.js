/**
 * patch-image-paths.js
 * Corrects stale image_url values in the products table.
 *
 * Safe rules:
 *   - Only UPDATE rows whose image_url starts with '/public/products/'
 *   - Uses REPLACE() in SQL — no rows are deleted or recreated
 *   - Idempotent: re-running when paths are already correct is a no-op
 *
 * Usage: node backend/database/patches/patch-image-paths.js
 */
import { query } from "../../src/config/database.js";
import pool from "../../src/config/database.js";

async function run() {
  // Preview: how many rows need updating?
  const { rows: preview } = await query(
    `SELECT id, name, image_url FROM products WHERE image_url LIKE '/public/products/%'`
  );

  if (preview.length === 0) {
    console.log("[Patch] Nenhum registro com caminho legado encontrado. Nada a fazer.");
    return;
  }

  console.log(`[Patch] ${preview.length} registro(s) com caminho legado:`);
  for (const r of preview) {
    console.log(`  [${r.id}] ${r.name}  →  ${r.image_url}`);
  }

  // Apply the fix
  const { rowCount } = await query(
    `UPDATE products
     SET    image_url  = REPLACE(image_url, '/public/products/', '/assets/images/products/'),
            updated_at = NOW()
     WHERE  image_url LIKE '/public/products/%'`
  );

  console.log(`[Patch] ${rowCount} registro(s) atualizado(s) com sucesso.`);

  // Verify
  const { rows: check } = await query(
    `SELECT id, name, image_url FROM products WHERE image_url LIKE '/public/products/%'`
  );
  if (check.length === 0) {
    console.log("[Patch] Verificação OK — nenhum caminho legado restante.");
  } else {
    console.warn(`[Patch] ATENÇÃO: ${check.length} linha(s) ainda com caminho legado.`);
    for (const r of check) console.warn(`  [${r.id}] ${r.image_url}`);
  }
}

run()
  .catch((err) => {
    console.error("[Patch] Erro:", err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
