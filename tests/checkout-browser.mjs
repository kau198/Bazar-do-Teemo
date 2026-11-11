import { chromium } from "playwright";
import express from "express";
import session from "express-session";
import { newDb } from "pg-mem";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { up } from "../backend/database/migrations/002_orders.js";
import orderRoutes from "../backend/src/routes/orders.js";
import { errorHandler } from "../backend/src/middlewares/errorHandler.js";

const { items: products } = JSON.parse(
  await fs.readFile(new URL("../data/products.json", import.meta.url)),
);
const { Pool } = newDb().adapters.createPg();
const pool = new Pool();
await pool.query(
  "CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES (1)",
);
await pool.query(
  "CREATE TABLE products(id INTEGER PRIMARY KEY,name TEXT,price NUMERIC(10,2),currency TEXT,sizes TEXT[])",
);
for (const p of products)
  await pool.query("INSERT INTO products VALUES ($1,$2,$3,$4,$5)", [
    p.id,
    p.name,
    p.price,
    p.currency,
    p.sizes,
  ]);
await up(pool);
  await pool.query("ALTER TABLE products ADD COLUMN stock INTEGER; ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT TRUE; UPDATE products SET active=TRUE");
const app = express();
app.use(express.json());
app.use(
  session({
    secret: "isolated-browser-test-secret",
    resave: false,
    saveUninitialized: false,
  }),
);
const user = {
  id: 1,
  name: "Explorador Teste",
  email: "teste@example.invalid",
};
app.get("/api/v1/auth/me", (req, res) =>
  res.json({ user: req.session.userId ? user : null }),
);
app.post("/api/v1/auth/login", (req, res) => {
  req.session.userId = 1;
  res.json({ user });
});
app.get("/api/v1/products", (req, res) =>
  res.json({ items: products, total: products.length }),
);
app.get("/api/v1/categories", (req, res) =>
  res.json({ categories: [...new Set(products.map((p) => p.category))] }),
);
app.use("/api/v1/orders", orderRoutes(pool));
const frontend = path.resolve("frontend");
app.use(express.static(frontend, { index: false }));
app.get("/", (req, res) =>
  res.sendFile(path.join(frontend, "pages/index.html")),
);
app.get("/checkout", (req, res) =>
  res.sendFile(path.join(frontend, "pages/checkout.html")),
);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  headless: true,
});
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() =>
      localStorage.setItem("baazar-cart-v2", JSON.stringify({ 1: 1 })),
    );
    await page.reload();
    await page.locator('[data-detail="1"]').first().waitFor();
    await page.locator(width < 600 ? "#mobile-cart" : "#cart").click();
    await page.getByRole("link", { name: "Finalizar compra" }).click();
    await page
      .locator("#checkout-auth input[name=email]")
      .fill("teste@example.invalid");
    await page
      .locator("#checkout-auth input[name=password]")
      .fill("senha-teste");
    await page.locator("#checkout-login").click();
    await page.locator("#checkout-layout").waitFor({ state: "visible" });
    const fields = {
      phone: "11999999999",
      postalCode: "01001-000",
      street: "Rua de Teste",
      number: "10",
      complement: "Apto 2",
      district: "Centro",
      city: "São Paulo",
    };
    for (const [key, value] of Object.entries(fields))
      await page.locator(`#checkout-form [name=${key}]`).fill(value);
    await page.locator("[name=state]").selectOption("SP");
    await page.locator("#review-order").click();
    await page.waitForFunction(
      () => !document.querySelector("#place-order").disabled,
    );
    assert.match(await page.locator("#checkout-totals").innerText(), /179,80/);
    assert.match(await page.locator("#address-review").innerText(), /Apto 2/);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `docs/preview-checkout-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() =>
      localStorage.setItem("baazar-cart-v2", JSON.stringify({ 1: 1, 2: 1 })),
    );
    let lostResponse = false;
    await page.route(/\/api\/v1\/orders$/, async (route) => {
      if (!lostResponse) {
        lostResponse = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    const before = (await pool.query("SELECT * FROM orders")).rows.length;
    await page.locator("#place-order").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#checkout-status")
        .textContent.includes("sem duplicá-lo"),
    );
    await page.locator("#place-order").click();
    await page.locator("#checkout-success").waitFor({ state: "visible" });
    assert.equal(
      (await pool.query("SELECT * FROM orders")).rows.length,
      before + 1,
    );
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("baazar-cart-v2")),
      ),
      { 2: 1 },
    );
    assert.match(await page.locator("#order-receipt").innerText(), /179,80/);
    await page.screenshot({
      path: `docs/preview-checkout-confirmado-${width}.png`,
      fullPage: true,
    });
    await page.reload();
    await page.locator("#checkout-success").waitFor({ state: "visible" });
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("baazar-cart-v2")),
      ),
      { 2: 1 },
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px: sacola, login, endereço, frete, revisão, confirmação, recuperação de falha sem duplicação e recibo após recarregar`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}
