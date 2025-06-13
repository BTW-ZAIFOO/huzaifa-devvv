import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  createPost,
  getPosts,
  getUserPosts,
  likeUnlikePost,
  commentOnPost,
  getTrendingTopics,
  deletePost,
  updatePost,
} from "../controllers/postController.js";
import upload from "../middlewares/multer.js";

const router = express.Router();

// Get all posts from followed users and own posts
router.get("/", isAuthenticated, getPosts);

// Get all posts for the feed
router.get("/all", isAuthenticated, getPosts);

// Create new post
router.post("/create", isAuthenticated, upload.single("media"), createPost);

// Like/unlike post routes
router.post("/:postId/like", isAuthenticated, likeUnlikePost);
router.post("/:postId/unlike", isAuthenticated, likeUnlikePost);

// Comment routes
router.post("/:postId/comment", isAuthenticated, commentOnPost);

// Get posts by user
router.get("/user/:userId", isAuthenticated, getUserPosts);

// Get trending topics
router.get("/trending/topics", isAuthenticated, getTrendingTopics);

// Add routes for updating and deleting posts
router.put("/:postId", isAuthenticated, upload.single("media"), updatePost);
router.delete("/:postId", isAuthenticated, deletePost);

export default router;
