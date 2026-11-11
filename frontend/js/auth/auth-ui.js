/**
 * auth-ui.js — Controlador do modal de autenticação no front-end.
 * Carrega em todas as páginas que incluem o bloco #auth-modal.
 */
import { getSession, login, logout, register } from "/js/auth/auth.js";

const $ = (s) => document.querySelector(s);

// ── Estado ─────────────────────────────────────────────────────────────────
let currentUser = null;

// ── Inicialização ──────────────────────────────────────────────────────────
async function init() {
  currentUser = await getSession();
  updateHeaderBtn(currentUser);
  setupModal();
}

// ── Header button ──────────────────────────────────────────────────────────
function updateHeaderBtn(user) {
  const btn = $("#auth-btn");
  const label = $("#auth-btn-label");
  if (!btn) return;
  if (user) {
    btn.setAttribute("aria-label", `Conta de ${user.name}`);
    btn.classList.add("logged-in");
    if (label) label.textContent = user.name.split(" ")[0]; // first name
  } else {
    btn.setAttribute("aria-label", "Entrar na conta");
    btn.classList.remove("logged-in");
    if (label) label.textContent = "Entrar";
  }
}

// ── Modal setup ────────────────────────────────────────────────────────────
function setupModal() {
  const modal = $("#auth-modal");
  if (!modal) return;

  // Open modal
  $("#auth-btn")?.addEventListener("click", () => {
    refreshModalState();
    modal.showModal();
  });

  // Close via [data-close] or backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      const r = modal.getBoundingClientRect();
      if (
        e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top  || e.clientY > r.bottom
      ) modal.close();
    }
    if (e.target.closest("[data-close]")) modal.close();
  });

  // Tabs
  $("#tab-login")?.addEventListener("click", () => switchTab("login"));
  $("#tab-register")?.addEventListener("click", () => switchTab("register"));

  // Toggle password visibility
  modal.addEventListener("click", (e) => {
    const btn = e.target.closest(".auth-toggle-pw");
    if (!btn) return;
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    btn.setAttribute("aria-label", isText ? "Mostrar senha" : "Ocultar senha");
  });

  // Login form
  $("#login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailEl = $("#login-email");
    const pwEl = $("#login-password");
    const errEl = $("#login-error");
    const submitBtn = $("#login-submit");
    const spinner = submitBtn?.querySelector(".auth-spinner");

    clearError(errEl);
    setLoading(submitBtn, spinner, true);

    try {
      const user = await login({
        email: emailEl.value,
        password: pwEl.value,
      });
      currentUser = user;
      updateHeaderBtn(user);
      refreshModalState();
      modal.close();
      showToast(`Bem-vindo, ${user.name.split(" ")[0]}!`);
    } catch (err) {
      showError(errEl, err.message);
    } finally {
      setLoading(submitBtn, spinner, false);
    }
  });

  // Register form
  $("#register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#reg-name").value.trim();
    const email = $("#reg-email").value;
    const password = $("#reg-password").value;
    const confirmPassword = $("#reg-confirm").value;
    const errEl = $("#register-error");
    const submitBtn = $("#register-submit");
    const spinner = submitBtn?.querySelector(".auth-spinner");

    clearError(errEl);

    // Client-side validation
    if (name.length < 2) return showError(errEl, "Nome muito curto.");
    if (password.length < 8) return showError(errEl, "A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirmPassword) return showError(errEl, "As senhas não coincidem.");

    setLoading(submitBtn, spinner, true);

    try {
      const user = await register({ name, email, password, confirmPassword });
      currentUser = user;
      updateHeaderBtn(user);
      refreshModalState();
      modal.close();
      showToast(`Conta criada! Bem-vindo, ${user.name.split(" ")[0]}!`);
    } catch (err) {
      showError(errEl, err.message);
    } finally {
      setLoading(submitBtn, spinner, false);
    }
  });

  // Logout
  $("#logout-btn")?.addEventListener("click", async () => {
    await logout();
    currentUser = null;
    updateHeaderBtn(null);
    refreshModalState();
    modal.close();
    showToast("Você saiu da conta.");
  });
}

function refreshModalState() {
  const loginPanel = $("#panel-login");
  const registerPanel = $("#panel-register");
  const loggedPanel = $("#panel-loggedin");
  const tabsEl = $(".auth-tabs");

  if (currentUser) {
    loginPanel?.setAttribute("hidden", "");
    registerPanel?.setAttribute("hidden", "");
    tabsEl?.setAttribute("hidden", "");
    if (loggedPanel) {
      loggedPanel.removeAttribute("hidden");
      let adminLink = loggedPanel.querySelector("[data-admin-link]");
      if (!adminLink) {
        adminLink = document.createElement("a");
        adminLink.href = "/admin";
        adminLink.dataset.adminLink = "";
        adminLink.textContent = "Abrir painel administrativo →";
        adminLink.style.cssText = "display:block;margin:18px 0;color:var(--green);font-weight:600";
        loggedPanel.append(adminLink);
      }
      adminLink.hidden = currentUser.role !== "admin";
      const nameEl = $("#auth-user-name");
      if (nameEl) nameEl.textContent = currentUser.name;
    }
  } else {
    tabsEl?.removeAttribute("hidden");
    loggedPanel?.setAttribute("hidden", "");
    switchTab("login");
  }
}

function switchTab(tab) {
  const isLogin = tab === "login";
  const loginPanel = $("#panel-login");
  const registerPanel = $("#panel-register");
  const tabLogin = $("#tab-login");
  const tabRegister = $("#tab-register");

  if (loginPanel) loginPanel.hidden = !isLogin;
  if (registerPanel) registerPanel.hidden = isLogin;
  if (tabLogin) {
    tabLogin.classList.toggle("selected", isLogin);
    tabLogin.setAttribute("aria-selected", String(isLogin));
  }
  if (tabRegister) {
    tabRegister.classList.toggle("selected", !isLogin);
    tabRegister.setAttribute("aria-selected", String(!isLogin));
  }
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.removeAttribute("hidden");
}

function clearError(el) {
  if (!el) return;
  el.textContent = "";
  el.setAttribute("hidden", "");
}

function setLoading(btn, spinner, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (spinner) spinner.hidden = !loading;
}

function showToast(msg) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3500);
}

init();
