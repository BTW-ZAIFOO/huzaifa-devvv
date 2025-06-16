import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import { User } from "../models/userModal.js";
import { Post } from "../models/postModel.js";

const router = express.Router();

router.get("/all", isAuthenticated, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === "") {
    return res.json({ users: [], posts: [] });
  }
  const [users, posts] = await Promise.all([
    User.find({
      name: { $regex: q, $options: "i" },
      accountVerified: true,
    }).select("name email avatar"),
    Post.find({
      content: { $regex: q, $options: "i" },
    })
      .populate("user", "name avatar")
      .select("content user"),
  ]);
  res.json({
    users,
    posts: posts.map((p) => ({
      _id: p._id,
      content: p.content,
      author: p.user,
    })),
  });
});

export default router;
