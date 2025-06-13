import express from "express";
import * as userController from "../controllers/userControllers.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { uploadAvatar } from "../middlewares/fileUpload.js";

const router = express.Router();

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", userController.logout);

router.get("/me", isAuthenticated, userController.getMyProfile);

router.put(
  "/update",
  isAuthenticated,
  uploadAvatar.single("avatar"),
  userController.updateProfile
);
router.put("/update-password", isAuthenticated, userController.updatePassword);

router.get("/all", isAuthenticated, userController.getAllUsers);
router.get("/followers", isAuthenticated, userController.getFollowers);
router.get("/following", isAuthenticated, userController.getFollowing);
router.post("/follow/:userId", isAuthenticated, userController.followUser);
router.post("/unfollow/:userId", isAuthenticated, userController.unfollowUser);
router.get("/profile/:userId", isAuthenticated, userController.getUserProfile);
router.post("/status", isAuthenticated, userController.updateUserStatus); // Using the correct method name

router.get("/online", isAuthenticated, userController.getOnlineUsers);

export default router;
