import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { Post } from "../models/postModel.js";
import { User } from "../models/userModal.js";

export const adminDeletePost = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;
  const { reason } = req.body;

  if (!req.user.role === "admin") {
    return next(new ErrorHandler("Unauthorized access", 403));
  }

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  const postAuthor = await User.findById(post.user);

  if (!post.moderationHistory) post.moderationHistory = [];

  post.moderationHistory.push({
    action: "deleted",
    adminId: req.user._id,
    adminName: req.user.name,
    reason: reason || "Violation of community guidelines",
    date: new Date(),
  });

  if (postAuthor) {
    if (!postAuthor.notifications) postAuthor.notifications = [];

    postAuthor.notifications.unshift({
      id: `post-deleted-${Date.now()}`,
      type: "post_deleted",
      title: "Post Removed",
      message: `Your post has been removed by an administrator: "${
        reason || "Violation of community guidelines"
      }"`,
      createdAt: new Date().toISOString(),
      read: false,
      severity: "medium",
      adminName: req.user.name,
      adminAction: true,
      actionTimestamp: new Date().toISOString(),
    });

    await postAuthor.save();
  }

  await Post.findByIdAndDelete(postId);

  if (req.app.get("io") && postAuthor) {
    req.app
      .get("io")
      .to(`user:${postAuthor._id}`)
      .emit("post-moderation", {
        action: "deleted",
        postId,
        reason: reason || "Violation of community guidelines",
        adminName: req.user.name,
        timestamp: new Date().toISOString(),
      });
  }

  res.status(200).json({
    success: true,
    message: "Post deleted by admin successfully",
  });
});

export const adminHidePost = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;
  const { reason } = req.body;

  if (!req.user.role === "admin") {
    return next(new ErrorHandler("Unauthorized access", 403));
  }

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  const postAuthor = await User.findById(post.user);

  if (!post.moderationHistory) post.moderationHistory = [];

  post.moderationHistory.push({
    action: "hidden",
    adminId: req.user._id,
    adminName: req.user.name,
    reason: reason || "Content under review",
    date: new Date(),
  });

  post.isHidden = true;
  await post.save();

  if (postAuthor) {
    if (!postAuthor.notifications) postAuthor.notifications = [];

    postAuthor.notifications.unshift({
      id: `post-hidden-${Date.now()}`,
      type: "post_hidden",
      title: "Post Hidden",
      message: `Your post has been hidden from public view: "${
        reason || "Content under review"
      }"`,
      createdAt: new Date().toISOString(),
      read: false,
      severity: "medium",
      adminName: req.user.name,
      adminAction: true,
      actionTimestamp: new Date().toISOString(),
    });

    await postAuthor.save();
  }

  if (req.app.get("io") && postAuthor) {
    req.app
      .get("io")
      .to(`user:${postAuthor._id}`)
      .emit("post-moderation", {
        action: "hidden",
        postId,
        reason: reason || "Content under review",
        adminName: req.user.name,
        timestamp: new Date().toISOString(),
      });
  }

  res.status(200).json({
    success: true,
    message: "Post hidden by admin successfully",
  });
});

export const adminWarnPostAuthor = catchAsyncError(async (req, res, next) => {
  const { postId } = req.params;
  const { reason } = req.body;

  if (!req.user.role === "admin") {
    return next(new ErrorHandler("Unauthorized access", 403));
  }

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ErrorHandler("Post not found", 404));
  }

  const postAuthor = await User.findById(post.user);
  if (!postAuthor) {
    return next(new ErrorHandler("Post author not found", 404));
  }

  if (!post.moderationHistory) post.moderationHistory = [];

  post.moderationHistory.push({
    action: "warning",
    adminId: req.user._id,
    adminName: req.user.name,
    reason: reason || "Content warning",
    date: new Date(),
  });

  await post.save();

  if (!postAuthor.notifications) postAuthor.notifications = [];
  if (!postAuthor.warnings) postAuthor.warnings = [];

  const warningId = `warning-${Date.now()}`;

  postAuthor.notifications.unshift({
    id: warningId,
    type: "warning",
    title: "Content Warning",
    message: `You've received a warning about a post: "${
      reason || "Inappropriate content"
    }"`,
    createdAt: new Date().toISOString(),
    read: false,
    severity: "high",
    adminName: req.user.name,
    adminAction: true,
    actionTimestamp: new Date().toISOString(),
    postId: post._id,
  });

  postAuthor.warnings.push({
    id: warningId,
    reason: reason || "Inappropriate content",
    date: new Date(),
    adminId: req.user._id,
    adminName: req.user.name,
    contentType: "post",
    contentId: post._id,
  });

  await postAuthor.save();

  if (req.app.get("io")) {
    req.app
      .get("io")
      .to(`user:${postAuthor._id}`)
      .emit("post-moderation", {
        action: "warning",
        postId,
        reason: reason || "Inappropriate content",
        adminName: req.user.name,
        timestamp: new Date().toISOString(),
      });
  }

  res.status(200).json({
    success: true,
    message: "Warning sent to post author successfully",
  });
});

export const getReportedPosts = catchAsyncError(async (req, res, next) => {
  if (!req.user.role === "admin") {
    return next(new ErrorHandler("Unauthorized access", 403));
  }

  const reportedPosts = await Post.find({ isReported: true })
    .sort({ createdAt: -1 })
    .populate("user", "name avatar email")
    .populate("comments.user", "name avatar");

  res.status(200).json({
    success: true,
    count: reportedPosts.length,
    posts: reportedPosts,
  });
});
