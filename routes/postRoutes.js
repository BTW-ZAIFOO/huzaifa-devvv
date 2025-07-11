import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import upload from "../middlewares/multer.js";
import {
  createPost,
  getPosts,
  getUserPosts,
  likeUnlikePost,
  commentOnPost,
  getTrendingTopics,
  deletePost,
  updatePost,
  searchPosts,
} from "../controllers/postController.js";

const router = express.Router();

router.get("/", isAuthenticated, getPosts);
router.get("/all", isAuthenticated, getPosts);
router.post("/create", isAuthenticated, upload.single("media"), createPost);
router.post("/:postId/like", isAuthenticated, likeUnlikePost);
router.post("/:postId/unlike", isAuthenticated, likeUnlikePost);
router.post("/:postId/comment", isAuthenticated, commentOnPost);
router.get("/user/:userId", isAuthenticated, getUserPosts);
router.get("/trending/topics", isAuthenticated, getTrendingTopics);
router.put("/:postId", isAuthenticated, upload.single("media"), updatePost);
router.delete("/:postId", isAuthenticated, deletePost);
router.get("/search", isAuthenticated, searchPosts);

export default router;
