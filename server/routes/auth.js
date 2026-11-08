import { Router } from "express";
import {
  register,
  login,
  logout,
  me,
  registerValidation,
  loginValidation,
} from "../controllers/authController.js";

const router = Router();

router.get("/me", me);
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.post("/logout", logout);

export default router;
