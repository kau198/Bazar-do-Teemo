/**
 * Serviço de autenticação do front-end.
 * Comunica com a API /api/v1/auth.
 */

const AUTH_BASE = "/api/v1/auth";

/**
 * @typedef {{ id: number, name: string, email: string }} User
 */

/**
 * Verifica se há uma sessão ativa e retorna o usuário, ou null.
 * @returns {Promise<User|null>}
 */
export async function getSession() {
  try {
    const res = await fetch(`${AUTH_BASE}/me`, { credentials: "same-origin" });
    if (!res.ok) return null;
    const { user } = await res.json();
    return user || null;
  } catch {
    return null;
  }
}

/**
 * Cadastra um novo usuário.
 * @param {{ name: string, email: string, password: string, confirmPassword: string }} data
 * @returns {Promise<User>}
 */
export async function register({ name, email, password, confirmPassword }) {
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name, email, password, confirmPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao cadastrar.");
  return data.user;
}

/**
 * Faz login com e-mail e senha.
 * @param {{ email: string, password: string }} data
 * @returns {Promise<User>}
 */
export async function login({ email, password }) {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Credenciais inválidas.");
  return data.user;
}

/**
 * Faz logout encerrando a sessão no servidor.
 * @returns {Promise<void>}
 */
export async function logout() {
  await fetch(`${AUTH_BASE}/logout`, {
    method: "POST",
    credentials: "same-origin",
  });
}
