/**
 * Bazar do Teemo — Servidor Express
 * Serve o front-end estático + API REST v1.
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

import pool from "./config/database.js";
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const isProd = process.env.NODE_ENV === "production";
const PORT = parseInt(process.env.PORT || "3000", 10);

if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET não configurada. Copie .env.example para .env e defina um segredo forte."
  );
}

const app = express();

// ── Segurança ────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // app.js usa módulos inline
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// ── CORS (dev only) ──────────────────────────────────────────────────────────
if (!isProd) {
  app.use(cors({ origin: true, credentials: true }));
}

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// ── Rate limiter global ──────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
  })
);

// Rate limiter mais restrito para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// ── Sessões ──────────────────────────────────────────────────────────────────
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
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    },
  })
);

// ── Rotas da API ─────────────────────────────────────────────────────────────
app.use("/api/v1", productRoutes);
app.use("/api/v1/auth", authLimiter, authRoutes);

// ── Arquivos estáticos do front-end ──────────────────────────────────────────
// Serve todos os arquivos da raiz do projeto (HTML, CSS, JS, imagens)
app.use(
  express.static(root, {
    index: false, // tratado manualmente abaixo
    setHeaders(res, filePath) {
      if (filePath.endsWith(".webmanifest")) {
        res.setHeader("Content-Type", "application/manifest+json");
      }
    },
  })
);

// ── SPA fallback — serve HTML para rotas conhecidas ──────────────────────────
const staticPages = {
  "/": "index.html",
  "/catalogo": "catalogo.html",
  "/catalogo.html": "catalogo.html",
  "/contato": "contato.html",
  "/contato.html": "contato.html",
};

app.get("/{*path}", async (req, res, next) => {
  // Não interceptar rotas de API
  if (req.path.startsWith("/api/")) return next();

  const page = staticPages[req.path] || "index.html";
  try {
    const data = await readFile(path.join(root, page));
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
