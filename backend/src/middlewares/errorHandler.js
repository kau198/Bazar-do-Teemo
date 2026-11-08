import { AppError } from "../utils/errors.js";

/**
 * Middleware centralizado de tratamento de erros.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (Array.isArray(err)) {
    return res.status(400).json({ error: err[0]?.msg || "Dados inválidos." });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.code === "23505") {
    return res.status(409).json({ error: "Registro já existe." });
  }
  console.error("[Server] Erro não tratado:", err);
  res.status(500).json({ error: "Erro interno do servidor." });
}
