import pool from "../src/config/database.js";
const [email, action = "grant"] = process.argv.slice(2);
try {
  if (!email || !["grant", "revoke"].includes(action)) throw new Error("Uso: npm run admin -- email@exemplo.com [grant|revoke]");
  const result = await pool.query("UPDATE users SET role=$1,updated_at=NOW() WHERE email=$2 RETURNING id", [action === "grant" ? "admin" : "customer",email.trim().toLowerCase()]);
  if (!result.rows.length) throw new Error("Cadastre essa conta na loja primeiro.");
  console.log(action === "grant" ? "Permissão de administrador concedida." : "Permissão de administrador removida.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }
