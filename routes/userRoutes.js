import express from "express";
import * as userController from "../controllers/userControllers.js";
import { isAuthenticated } from "../middlewares/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

const avatarDir = "./public/uploads/avatars";
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: fileFilter,
});

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

router.post("/follow/:userId", isAuthenticated, userController.followUser);
router.post("/unfollow/:userId", isAuthenticated, userController.unfollowUser);
router.get("/followers", isAuthenticated, userController.getFollowers);
router.get("/following", isAuthenticated, userController.getFollowing);
router.get("/profile/:userId", isAuthenticated, userController.getUserProfile);
router.get("/suggested", isAuthenticated, userController.getSuggestedUsers);

router.put(
  "/update",
  isAuthenticated,
  upload.single("avatar"),
  userController.updateProfile
);
router.put("/update-password", isAuthenticated, userController.updatePassword);

export default router;
