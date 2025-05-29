import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";

import {
  register,
  verifyOTP,
  login,
  logout,
  getUser,
  forgotPassword,
  resetPassword,
  getAllUsers,
  searchUsers,
} from "../controllers/userControllers.js";

const router = express.Router();

router.post("/register", register);
router.post("/otp-verification", verifyOTP);
router.post("/login", login);
router.get("/logout", isAuthenticated, logout);
router.get("/me", isAuthenticated, getUser);
router.post("/password/forgot", forgotPassword);
router.put("/password/reset/:token", resetPassword);
router.get("/all", isAuthenticated, getAllUsers);
router.get("/search", isAuthenticated, searchUsers);

export default router;