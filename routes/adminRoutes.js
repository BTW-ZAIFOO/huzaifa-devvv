import express from "express";
import {
  adminDeletePost,
  adminHidePost,
  adminWarnPostAuthor,
  getReportedPosts,
} from "../controllers/adminController.js";
import { isAuthenticated, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

router.post(
  "/post/:postId/delete",
  isAuthenticated,
  authorizeRoles("admin"),
  adminDeletePost
);
router.post(
  "/post/:postId/hide",
  isAuthenticated,
  authorizeRoles("admin"),
  adminHidePost
);
router.post(
  "/post/:postId/warn",
  isAuthenticated,
  authorizeRoles("admin"),
  adminWarnPostAuthor
);
router.get(
  "/posts/reported",
  isAuthenticated,
  authorizeRoles("admin"),
  getReportedPosts
);

export default router;
