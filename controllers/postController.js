import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { Post } from "../models/postModel.js";
import { User } from "../models/userModal.js";

export const createPost = catchAsyncError(async (req, res, next) => {
  const { content } = req.body;

  if (!content) {
    return next(new ErrorHandler("Post content is required", 400));
  }

  let media = null;
  if (req.file) {
    media = req.file.path;
  }

  const post = await Post.create({
    user: req.user._id,
    content,
    media,
  });

  const populatedPost = await Post.findById(post._id).populate(
    "user",
    "name avatar"
  );

  if (global.io) {
    global.io.emit("new-post", populatedPost);
  }

  res.status(201).json({
    success: true,
    post: populatedPost,
  });
});

export const getPosts = catchAsyncError(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const following = req.user.following || [];
  const users = [...following, req.user._id];

  try {
    const posts = await Post.find({ user: { $in: users } })
      .sort({ createdAt: -1 })
      .populate("user", "name avatar")
      .populate({
        path: "comments.user",
        select: "name avatar",
      })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments({ user: { $in: users } });

    res.status(200).json({
      success: true,
      posts,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

export const getUserPosts = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const posts = await Post.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate("user", "name avatar")
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Post.countDocuments({ user: userId });

  res.status(200).json({
    success: true,
    posts,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  });
});

export const likeUnlikePost = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  const isLiked = post.likes && post.likes.includes(req.user._id);

  if (isLiked) {
    await Post.findByIdAndUpdate(postId, {
      $pull: { likes: req.user._id },
    });

    res.status(200).json({
      success: true,
      message: "Post unliked",
    });
  } else {
    await Post.findByIdAndUpdate(postId, {
      $push: { likes: req.user._id },
    });

    if (post.user.toString() !== req.user._id.toString() && global.io) {
      global.io.emit("post-liked", {
        postId,
        likedBy: {
          _id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar,
        },
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Post liked",
    });
  }
});

export const commentOnPost = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;
  const { text } = req.body;

  if (!text) {
    return next(new ErrorHandler("Comment text is required", 400));
  }

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  const comment = {
    user: req.user._id,
    text,
  };

  post.comments.push(comment);
  await post.save();

  // Populate the user details for the new comment
  const populatedPost = await Post.findById(postId).populate({
    path: "comments.user",
    select: "name avatar",
    match: { _id: req.user._id },
  });

  const newComment = populatedPost.comments[populatedPost.comments.length - 1];

  if (post.user.toString() !== req.user._id.toString() && global.io) {
    global.io.emit("post-commented", {
      postId,
      commentedBy: {
        _id: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar,
      },
      comment: text,
      timestamp: new Date(),
    });
  }

  res.status(201).json({
    success: true,
    comment: newComment,
  });
});

export const deleteComment = catchAsyncError(async (req, res, next) => {
  const { postId, commentId } = req.params;

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  const commentIndex = post.comments.findIndex(
    (c) => c._id.toString() === commentId
  );

  if (commentIndex === -1) {
    return next(new ErrorHandler("Comment not found", 404));
  }

  const comment = post.comments[commentIndex];
  if (
    comment.user.toString() !== req.user._id.toString() &&
    post.user.toString() !== req.user._id.toString()
  ) {
    return next(new ErrorHandler("Not authorized to delete this comment", 403));
  }

  post.comments.splice(commentIndex, 1);
  await post.save();

  res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});

export const updatePost = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;
  const { content } = req.body;

  if (!content) {
    return next(new ErrorHandler("Post content is required", 400));
  }

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  if (post.user.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Not authorized to update this post", 403));
  }

  post.content = content;
  post.updatedAt = Date.now();
  await post.save();

  const updatedPost = await Post.findById(postId).populate(
    "user",
    "name avatar"
  );

  if (global.io) {
    global.io.emit("post-updated", updatedPost);
  }

  res.status(200).json({
    success: true,
    post: updatedPost,
  });
});

export const deletePost = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  if (post.user.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Not authorized to delete this post", 403));
  }

  await Post.findByIdAndDelete(postId);

  if (global.io) {
    global.io.emit("post-deleted", { postId });
  }

  res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});

export const getAllPosts = catchAsyncError(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .populate("user", "name avatar")
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Post.countDocuments();

  res.status(200).json({
    success: true,
    posts,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  });
});

export const getTrendingPosts = catchAsyncError(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const posts = await Post.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $addFields: {
        likesCount: { $size: { $ifNull: ["$likes", []] } },
        commentsCount: { $size: { $ifNull: ["$comments", []] } },
        interactionScore: {
          $add: [
            { $size: { $ifNull: ["$likes", []] } },
            { $multiply: [{ $size: { $ifNull: ["$comments", []] } }, 2] }, // Comments weighted more
          ],
        },
      },
    },
    { $sort: { interactionScore: -1 } },
    { $limit: limit * 1 },
  ]);

  const populatedPosts = await Post.populate(posts, {
    path: "user",
    select: "name avatar",
  });

  res.status(200).json({
    success: true,
    posts: populatedPosts,
    totalPages: 1,
    currentPage: 1,
  });
});

export const searchPosts = catchAsyncError(async (req, res, next) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.status(200).json({ success: true, posts: [] });
  }

  const posts = await Post.find({
    content: { $regex: q, $options: "i" },
  })
    .sort({ createdAt: -1 })
    .populate("user", "name avatar");

  res.status(200).json({
    success: true,
    posts,
  });
});

export const getTrendingTopics = catchAsyncError(async (req, res, next) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const posts = await Post.find({
      createdAt: { $gte: sevenDaysAgo },
    }).select("content");

    const hashtagRegex = /#(\w+)/g;
    const hashtags = {};

    posts.forEach((post) => {
      const matches = post.content.match(hashtagRegex);
      if (matches) {
        matches.forEach((tag) => {
          const cleanTag = tag.substring(1).toLowerCase(); // Remove # and lowercase
          hashtags[cleanTag] = (hashtags[cleanTag] || 0) + 1;
        });
      }
    });

    const topics = Object.entries(hashtags)
      .map(([name, postCount]) => ({ name, postCount }))
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 10);

    res.status(200).json({
      success: true,
      topics,
    });
  } catch (error) {
    next(new ErrorHandler("Failed to fetch trending topics", 500));
  }
});
