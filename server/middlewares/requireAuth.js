import { UnauthorizedError } from "../utils/errors.js";

/**
 * Middleware que exige sessão autenticada.
 * Adicione a rotas que requerem login.
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return next(new UnauthorizedError("Faça login para continuar."));
  }
  next();
}
