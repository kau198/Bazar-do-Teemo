import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { createOrderService } from "../services/orderService.js";
export default function orderRoutes(pool) {
  const router = Router();
  const service = createOrderService(pool);
  router.use(requireAuth);
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post("/quote", async (req, res) =>
    res.json(await service.quote(req.body)),
  );
  router.post("/", async (req, res) =>
    res
      .status(201)
      .json({
        order: await service.create(
          req.session.userId,
          req.body,
          req.get("Idempotency-Key"),
        ),
      }),
  );
  router.get("/:id", async (req, res) =>
    res.json({ order: await service.get(req.session.userId, req.params.id) }),
  );
  return router;
}
