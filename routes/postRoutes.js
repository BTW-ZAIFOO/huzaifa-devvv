import express from "express";
import {
  createPost,
  getPosts,
  getUserPosts,
  likeUnlikePost,
  addComment,
  deletePost,
  reportPost,
} from "../controllers/postController.js";
import { isAuthenticated } from "../middlewares/auth.js";
import multer from "multer";
import path from "path";

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/posts");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.post("/create", isAuthenticated, upload.single("media"), createPost);
router.get("/all", isAuthenticated, getPosts);
router.get("/user/:userId", isAuthenticated, getUserPosts);
router.post("/:postId/like", isAuthenticated, likeUnlikePost);
router.post("/:postId/comment", isAuthenticated, addComment);
router.delete("/:postId", isAuthenticated, deletePost);
router.post("/:postId/report", isAuthenticated, reportPost);

export default router;
