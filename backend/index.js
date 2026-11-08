/**
 * Bazar do Teemo — Servidor Express
 * Serve o front-end estático (frontend/) + API REST v1.
 */
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

import pool from "./src/config/database.js";
import productRoutes from "./src/routes/products.js";
import authRoutes from "./src/routes/auth.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Root of the project (one level up from backend/)
const projectRoot = path.resolve(__dirname, "..");
// Front-end static files live here
const frontendDir = path.join(projectRoot, "frontend");

const isProd = process.env.NODE_ENV === "production";
const PORT = parseInt(process.env.PORT || "3000", 10);

if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET não configurada. Copie .env.example para .env e defina um segredo forte."
  );
}

const app = express();

// ── Segurança ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'"],
        styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:    ["'self'", "https://fonts.gstatic.com"],
        imgSrc:     ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// ── CORS (dev only) ───────────────────────────────────────────────────────────
if (!isProd) {
  app.use(cors({ origin: true, credentials: true }));
}

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// ── Rate limiter global ───────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// ── Sessões ───────────────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    name: "bazar.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ── Rotas da API ──────────────────────────────────────────────────────────────
app.use("/api/v1", productRoutes);
app.use("/api/v1/auth", authLimiter, authRoutes);

// ── Arquivos estáticos do front-end ───────────────────────────────────────────
// frontend/ é a raiz pública; frontend/pages/ contém os HTMLs
app.use(
  express.static(frontendDir, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".webmanifest")) {
        res.setHeader("Content-Type", "application/manifest+json");
      }
    },
  })
);

// ── Rotas das páginas HTML ────────────────────────────────────────────────────
// Maps URL paths → HTML files inside frontend/pages/
const pageMap = {
  "/":             "pages/index.html",
  "/catalogo":     "pages/catalogo.html",
  "/catalogo.html":"pages/catalogo.html",
  "/contato":      "pages/contato.html",
  "/contato.html": "pages/contato.html",
};

app.get("/{*path}", async (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();

  const relPath = pageMap[req.path] || "pages/index.html";
  try {
    const data = await readFile(path.join(frontendDir, relPath));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(data);
  } catch {
    res.status(404).send("Página não encontrada.");
  }
});

// ── Tratamento centralizado de erros ─────────────────────────────────────────
app.use(errorHandler);

// ── Inicialização ─────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bazar do Teemo — http://localhost:${PORT} (${isProd ? "produção" : "desenvolvimento"})`);
});

export default app;
