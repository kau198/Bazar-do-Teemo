import { body, validationResult } from "express-validator";
import { registerUser, loginUser, getUserById } from "../services/authService.js";

export const registerValidation = [
  body("name").trim().isLength({ min: 2, max: 150 }).withMessage("Nome deve ter entre 2 e 150 caracteres."),
  body("email").isEmail().normalizeEmail().withMessage("E-mail inválido."),
  body("password").isLength({ min: 8 }).withMessage("A senha deve ter pelo menos 8 caracteres."),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) throw new Error("As senhas não coincidem.");
    return true;
  }),
];

export const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("E-mail inválido."),
  body("password").notEmpty().withMessage("Senha obrigatória."),
];

export async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const { name, email, password } = req.body;
    const user = await registerUser({ name, email, password });
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const { email, password } = req.body;
    const ip = req.ip;
    const user = await loginUser({ email, password, ip });
    await new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    await new Promise((resolve, reject) =>
      req.session.destroy((err) => (err ? reject(err) : resolve()))
    );
    res.clearCookie("bazar.sid");
    res.json({ message: "Sessão encerrada." });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    if (!req.session?.userId) return res.json({ user: null });
    const user = await getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.json({ user: null });
    }
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
}
