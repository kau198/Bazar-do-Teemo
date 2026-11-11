import test from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import express from "express";
import { up } from "../backend/database/migrations/002_orders.js";
import {
  createOrderService,
  validateCheckout,
  priceOrder,
} from "../backend/src/services/orderService.js";
import orderRoutes from "../backend/src/routes/orders.js";
import { errorHandler } from "../backend/src/middlewares/errorHandler.js";
const address = {
  recipient: "Explorador Teste",
  phone: "11999999999",
  postalCode: "01001000",
  street: "Rua de Teste",
  number: "10",
  complement: "",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
};
const body = () => ({
  items: [{ productId: 1, quantity: 1, size: "" }],
  address: { ...address },
});
const products = [
  { id: 1, name: "Pelúcia Teemo", price: "159.90", sizes: [], currency: "BRL" },
  {
    id: 2,
    name: "Camiseta",
    price: "99.90",
    sizes: ["M", "G"],
    currency: "BRL",
  },
];
async function setup() {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  await pool.query(
    "CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES (1),(2)",
  );
  await pool.query(
    "CREATE TABLE products(id INTEGER PRIMARY KEY, name TEXT, price NUMERIC(10,2), sizes TEXT[], currency TEXT)",
  );
  for (const p of products)
    await pool.query("INSERT INTO products VALUES ($1,$2,$3,$4,$5)", [
      p.id,
      p.name,
      p.price,
      p.sizes,
      p.currency,
    ]);
  await up(pool);
  await pool.query("ALTER TABLE products ADD COLUMN stock INTEGER; ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT TRUE; UPDATE products SET active=TRUE");
  return pool;
}
test("calcula centavos e frete sem aceitar preços do cliente", () => {
  const input = body();
  input.items[0].price = 0;
  assert.equal(priceOrder(validateCheckout(input), products).totalCents, 17980);
  input.items[0].quantity = 2;
  assert.equal(priceOrder(validateCheckout(input), products).totalCents, 31980);
  assert.equal(priceOrder(validateCheckout(input), products).shippingCents, 0);
});
test("rejeita endereço, quantidades, tamanhos e produtos inválidos", () => {
  for (const change of [
    (b) => (b.items = []),
    (b) => (b.items[0].quantity = 0),
    (b) => (b.items[0].quantity = 100),
    (b) => b.items.push({ ...b.items[0] }),
    (b) => (b.address.postalCode = "00000000"),
    (b) => (b.address.phone = "123"),
    (b) => (b.address.state = "XX"),
  ]) {
    const b = body();
    change(b);
    assert.throws(() => validateCheckout(b));
  }
  for (const item of [
    { productId: 2, quantity: 1, size: "" },
    { productId: 1, quantity: 1, size: "M" },
    { productId: 999, quantity: 1, size: "" },
  ])
    assert.throws(() =>
      priceOrder(validateCheckout({ ...body(), items: [item] }), products),
    );
});
test("salva pedido, reutiliza tentativa e protege pedidos de outra conta", async () => {
  const pool = await setup();
  const service = createOrderService(pool);
  const input = { ...body(), expectedTotalCents: 17980 };
  try {
    assert.equal((await service.quote(input)).totalCents, 17980);
    const first = await service.create(1, input, "test-request-00001");
    const second = await service.create(1, input, "test-request-00001");
    assert.equal(first.id, second.id);
    assert.equal((await service.get(1, first.id)).address.city, "São Paulo");
    assert.equal((await pool.query("SELECT * FROM orders")).rows.length, 1);
    await assert.rejects(
      service.get(2, first.id),
      (error) => error.status === 404,
    );
    await assert.rejects(
      service.create(
        1,
        { ...input, expectedTotalCents: 1 },
        "test-request-00001",
      ),
      (error) => error.status === 409,
    );
    await assert.rejects(
      service.create(
        1,
        { ...input, expectedTotalCents: 1 },
        "test-request-00002",
      ),
      (error) => error.status === 409,
    );
    assert.equal((await pool.query("SELECT * FROM orders")).rows.length, 1);
  } finally {
    await pool.end();
  }
});
test("API exige sessão e confirma pedido pela rota do checkout", async () => {
  const pool = await setup();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = req.headers["x-test-user"]
      ? { userId: Number(req.headers["x-test-user"]) }
      : {};
    next();
  });
  app.use("/orders", orderRoutes(pool));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    let response = await fetch(base + "/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body()),
    });
    assert.equal(response.status, 401);
    response = await fetch(base + "/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User": "1",
        "Idempotency-Key": "http-request-00001",
      },
      body: JSON.stringify({ ...body(), expectedTotalCents: 17980 }),
    });
    assert.equal(response.status, 201);
    const { order } = await response.json();
    assert.equal(order.status, "demo_confirmed");
    assert.equal(order.totalCents, 17980);
    response = await fetch(base + "/orders/" + order.id, {
      headers: { "X-Test-User": "2" },
    });
    assert.equal(response.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
