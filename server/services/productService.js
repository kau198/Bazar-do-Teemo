import { query } from "../config/database.js";
import { NotFoundError } from "../utils/errors.js";

/**
 * Retorna todos os produtos ou filtra por categoria.
 * @param {{ category?: string, sort?: string }} opts
 */
export async function getProducts({ category, sort } = {}) {
  let sql = `SELECT id, name, description, category, price, currency,
                    image_url, source_url, sizes, tag, art
             FROM products`;
  const params = [];

  if (category && category !== "Todos") {
    params.push(category);
    sql += ` WHERE category = $${params.length}`;
  }

  const orderMap = {
    low: "price ASC",
    high: "price DESC",
    new: "id DESC",
    featured: "id ASC",
  };
  sql += ` ORDER BY ${orderMap[sort] || "id ASC"}`;

  const { rows } = await query(sql, params);
  return rows.map(normalizeProduct);
}

/**
 * Retorna um produto pelo id.
 * @param {number} id
 */
export async function getProductById(id) {
  const { rows } = await query(
    `SELECT id, name, description, category, price, currency,
            image_url, source_url, sizes, tag, art
     FROM products WHERE id = $1`,
    [id]
  );
  if (!rows.length) throw new NotFoundError(`Produto ${id} não encontrado.`);
  return normalizeProduct(rows[0]);
}

/**
 * Pesquisa produtos por nome, descrição e categoria (case-insensitive, acentos).
 * @param {string} term
 * @param {{ category?: string, sort?: string }} opts
 */
export async function searchProducts(term, { category, sort } = {}) {
  const params = [`%${term.trim().toLowerCase()}%`];
  let sql = `SELECT id, name, description, category, price, currency,
                    image_url, source_url, sizes, tag, art
             FROM products
             WHERE (
               unaccent(lower(name))        LIKE unaccent($1)
               OR unaccent(lower(description)) LIKE unaccent($1)
               OR unaccent(lower(category))    LIKE unaccent($1)
             )`;

  if (category && category !== "Todos") {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  const orderMap = {
    low: "price ASC",
    high: "price DESC",
    new: "id DESC",
    featured: "id ASC",
  };
  sql += ` ORDER BY ${orderMap[sort] || "id ASC"}`;

  const { rows } = await query(sql, params).catch(async (err) => {
    // unaccent extension may not exist — fall back to ILIKE without it
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

/**
 * Retorna lista de categorias únicas ordenadas.
 */
export async function getCategories() {
  const { rows } = await query(
    `SELECT DISTINCT category FROM products ORDER BY category`
  );
  return rows.map((r) => r.category);
}

/** Normaliza coluna snake_case → camelCase para o front-end. */
function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    price: parseFloat(row.price),
    currency: row.currency,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    sizes: row.sizes ?? [],
    tag: row.tag ?? "",
    art: row.art ?? "",
  };
}
