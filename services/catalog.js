/**
 * Serviço de catálogo do front-end.
 * Consulta a API REST (/api/v1/products) em vez do arquivo JSON local.
 * A interface de retorno é idêntica à versão anterior para não quebrar app.js.
 */

const API_BASE = "/api/v1";

/**
 * Busca todos os produtos da API.
 * @returns {Promise<Product[]>}
 */
export async function listProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error("Não foi possível carregar o catálogo.");
  const data = await res.json();
  return validateAndReturn(data);
}

/**
 * Pesquisa produtos pelo termo (nome, descrição, categoria).
 * @param {string} term
 * @param {{ category?: string, sort?: string }} [opts]
 * @returns {Promise<Product[]>}
 */
export async function searchProducts(term, opts = {}) {
  const params = new URLSearchParams({ q: term });
  if (opts.category && opts.category !== "Todos") params.set("category", opts.category);
  if (opts.sort) params.set("sort", opts.sort);
  const res = await fetch(`${API_BASE}/products/search?${params}`);
  if (!res.ok) throw new Error("Erro na pesquisa.");
  const data = await res.json();
  return validateAndReturn(data);
}

/**
 * Retorna as categorias disponíveis.
 * @returns {Promise<string[]>}
 */
export async function listCategories() {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error("Não foi possível carregar as categorias.");
  const { categories } = await res.json();
  return categories;
}

/** @typedef {{ id: number, name: string, price: number, imageUrl: string, category: string, description: string, sizes: string[], tag: string, art: string, currency: string, sourceUrl: string|null }} Product */

function validateAndReturn(data) {
  if (
    !Array.isArray(data.items) ||
    data.items.some(
      (p) =>
        !Number.isInteger(p.id) ||
        typeof p.name !== "string" ||
        !Number.isFinite(p.price)
    )
  ) {
    throw new Error("O catálogo retornou dados inválidos.");
  }
  return data.items;
}
