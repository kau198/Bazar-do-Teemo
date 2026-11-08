import {
  getProducts,
  getProductById,
  searchProducts,
  getCategories,
} from "../services/productService.js";

export async function listProducts(req, res, next) {
  try {
    const { category, sort } = req.query;
    const products = await getProducts({ category, sort });
    res.json({ items: products, total: products.length });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido." });
    const product = await getProductById(id);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function searchProductsHandler(req, res, next) {
  try {
    const term = (req.query.q || "").trim();
    const { category, sort } = req.query;
    if (!term) {
      const products = await getProducts({ category, sort });
      return res.json({ items: products, total: products.length });
    }
    const products = await searchProducts(term, { category, sort });
    res.json({ items: products, total: products.length });
  } catch (err) {
    next(err);
  }
}

export async function listCategories(req, res, next) {
  try {
    const categories = await getCategories();
    res.json({ categories: ["Todos", ...categories] });
  } catch (err) {
    next(err);
  }
}
