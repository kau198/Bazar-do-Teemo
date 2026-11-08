import { Router } from "express";
import {
  listProducts,
  getProduct,
  searchProductsHandler,
  listCategories,
} from "../controllers/productController.js";

const router = Router();

// /search must come before /:id to avoid "search" being treated as an id
router.get("/products/search", searchProductsHandler);
router.get("/products/:id", getProduct);
router.get("/products", listProducts);
router.get("/categories", listCategories);

export default router;
