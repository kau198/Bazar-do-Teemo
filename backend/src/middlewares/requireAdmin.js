import { AppError, UnauthorizedError } from "../utils/errors.js";

export function requireAdmin(pool) {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!req.session?.userId) throw new UnauthorizedError("Entre com uma conta de administrador.");
    // Always consult the database: revocation applies to existing sessions immediately.
    const { rows } = await pool.query("SELECT id,name,email,role FROM users WHERE id=$1", [req.session.userId]);
    if (rows[0]?.role !== "admin") throw new AppError("Esta conta não tem permissão de administrador.", 403);
    req.admin = rows[0];
    next();
  };
}
