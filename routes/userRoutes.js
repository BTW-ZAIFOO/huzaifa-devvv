import express from "express";
import * as userController from "../controllers/userControllers.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", userController.register);
router.post("/otp-verification", userController.verifyOTP);
router.post("/login", userController.login);
router.get("/logout", isAuthenticated, userController.logout);
router.get("/me", isAuthenticated, userController.getUser);
router.post("/password/forgot", userController.forgotPassword);
router.put("/password/reset/:token", userController.resetPassword);
router.get("/all", isAuthenticated, userController.getAllUsers);
router.get("/search", isAuthenticated, userController.searchUsers);
router.post("/status", isAuthenticated, userController.updateUserStatus);
router.get("/online", isAuthenticated, userController.getOnlineUsers);

export default router;