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

  res.status(201).json({
    success: true,
    post: populatedPost,
  });
});

export const getPosts = catchAsyncError(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const following = req.user.following || [];
  const users = [...following, req.user._id];
  const posts = await Post.find({ user: { $in: users } })

    .sort({ createdAt: -1 })
    .populate("user", "name avatar")
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Post.countDocuments({ user: { $in: users } });

  res.status(200).json({
    success: true,
    posts,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  });
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

    res.status(200).json({
      success: true,
      message: "Post liked",
    });
  }
});

export const addComment = catchAsyncError(async (req, res, next) => {
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

  const updatedPost = await Post.findById(postId)
    .populate("user", "name avatar")
    .populate("comments.user", "name avatar");

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
    return next(new ErrorHandler("Unauthorized to delete this post", 403));
  }

  await Post.findByIdAndDelete(postId);

  res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});

export const reportPost = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return next(new ErrorHandler("Report reason is required", 400));
  }

  const post = await Post.findById(postId);

  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  post.isReported = true;
  post.reportReason = reason;
  await post.save();

  res.status(200).json({
    success: true,
    message: "Post reported successfully",
  });
});
