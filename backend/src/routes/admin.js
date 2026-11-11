import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { AppError, ValidationError } from "../utils/errors.js";
import { createAdminService } from "../services/adminService.js";

export default function adminRoutes(pool) {
  const router = Router();
  const service = createAdminService(pool);
  router.use(requireAdmin(pool));
  router.get("/session", (req,res) => {
    req.session.adminCsrf ||= randomBytes(32).toString("hex");
    res.json({ user: req.admin, csrfToken: req.session.adminCsrf });
  });
  router.use((req,res,next) => {
    if (!["GET","HEAD"].includes(req.method)) {
      const expected = Buffer.from(req.session.adminCsrf || "");
      const actual = Buffer.from(req.get("X-CSRF-Token") || "");
      if (!expected.length || expected.length !== actual.length || !timingSafeEqual(expected,actual))
        throw new AppError("Sessão de segurança expirada. Recarregue o painel.",403);
    }
    next();
  });
  router.get("/summary", async (req,res) => res.json(await service.summary()));
  router.get("/products", async (req,res) => res.json({ items: await service.products() }));
  router.post("/products", async (req,res) => res.status(201).json({ product: await service.save(null,req.body) }));
  router.put("/products/:id", async (req,res) => {
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) throw new ValidationError("Produto inválido.");
    res.json({ product: await service.save(Number(req.params.id),req.body) });
  });
  router.get("/orders", async (req,res) => res.json({ items: await service.orders() }));
  router.patch("/orders/:id/status", async (req,res) => res.json({ order: await service.status(req.params.id,req.body?.status) }));
  return router;
}
