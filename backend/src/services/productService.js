import { query } from "../config/database.js";
import { NotFoundError } from "../utils/errors.js";

export async function getProducts({ category, sort } = {}) {
  let sql = `SELECT id, name, description, category, price, currency,
                    image_url, source_url, sizes, tag, art, stock
             FROM products WHERE active = TRUE`;
  const params = [];

  if (category && category !== "Todos") {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  const orderMap = { low: "price ASC", high: "price DESC", new: "id DESC", featured: "id ASC" };
  sql += ` ORDER BY ${orderMap[sort] || "id ASC"}`;

  const { rows } = await query(sql, params);
  return rows.map(normalizeProduct);
}

export async function getProductById(id) {
  const { rows } = await query(
    `SELECT id, name, description, category, price, currency,
            image_url, source_url, sizes, tag, art, stock
     FROM products WHERE active = TRUE AND id = $1`,
    [id]
  );
  if (!rows.length) throw new NotFoundError(`Produto ${id} não encontrado.`);
  return normalizeProduct(rows[0]);
}

export async function searchProducts(term, { category, sort } = {}) {
  const params = [`%${term.trim().toLowerCase()}%`];
  let sql = `SELECT id, name, description, category, price, currency,
                    image_url, source_url, sizes, tag, art, stock
             FROM products
             WHERE active = TRUE AND (
               unaccent(lower(name))           LIKE unaccent($1)
               OR unaccent(lower(description))  LIKE unaccent($1)
               OR unaccent(lower(category))     LIKE unaccent($1)
             )`;

  if (category && category !== "Todos") {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  const orderMap = { low: "price ASC", high: "price DESC", new: "id DESC", featured: "id ASC" };
  sql += ` ORDER BY ${orderMap[sort] || "id ASC"}`;

  const { rows } = await query(sql, params).catch(async (err) => {
    if (err.code === "42883") {
      const fallback = sql
        .replace(/unaccent\(lower\((\w+)\)\)/g, "lower($1)")
        .replace(/unaccent\(\$1\)/g, "$1");
      return query(fallback, params);
    }
    throw err;
  });
  return rows.map(normalizeProduct);
}

export async function getCategories() {
  const { rows } = await query(`SELECT DISTINCT category FROM products WHERE active = TRUE ORDER BY category`);
  return rows.map((r) => r.category);
}

function normalizeProduct(row) {
  return {
    id: row.id,
    stock: row.stock,
    name: row.name,
    description: row.description,
    category: row.category,
    price: parseFloat(row.price),
    currency: row.currency,
    imageUrl: fixImagePath(row.image_url),
    sourceUrl: row.source_url,
    sizes: row.sizes ?? [],
    tag: row.tag ?? "",
    art: row.art ?? "",
  };
}

/**
 * Rewrites legacy /public/products/ paths to the current /assets/images/products/ location.
 * Safe to call on already-correct paths (no-op in that case).
 * @param {string} url
 */
function fixImagePath(url) {
  if (!url) return url;
  if (url.startsWith("/public/products/")) {
    return url.replace("/public/products/", "/assets/images/products/");
  }
  return url;
}
