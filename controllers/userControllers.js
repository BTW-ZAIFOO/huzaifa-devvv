import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userModal.js";
import { sendEmail } from "../utilis/sendEmail.js";
import twilio from "twilio";
import { sendToken } from "../utilis/sendToken.js";
import crypto from "crypto";
import fs from "fs";

const client = twilio(
  "ACe1de83735fa6aaaa6ebd63ac05e14154",
  "6efc22ccbd432b920577cea2ea867825"
);

export const register = catchAsyncError(async (req, res, next) => {
  try {
    const { name, email, password, verificationMethod, role } = req.body;
    if (!name || !email || !password || !verificationMethod) {
      return next(new ErrorHandler("All fields are required.", 400));
    }

    const existingUser = await User.findOne({
      $or: [
        {
          email,
          accountVerified: true,
        },
      ],
    });

    if (existingUser) {
      return next(new ErrorHandler("Email is already used.", 400));
    }

    const registerationAttemptsByUser = await User.find({
      $or: [{ email, accountVerified: false }],
    });

    if (registerationAttemptsByUser.length > 3) {
      return next(
        new ErrorHandler(
          "You have exceeded the maximum number of attempts (3). Please try again after an hour.",
          400
        )
      );
    }

    const userData = {
      name,
      email,
      password,
      role: role === "admin" ? "admin" : "user",
    };

    const user = await User.create(userData);
    const verificationCode = await user.generateVerificationCode();
    await user.save();
    sendVerificationCode(
      verificationMethod,
      verificationCode,
      name,
      email,
      res
    );
  } catch (error) {
    next(error);
  }
});

async function sendVerificationCode(
  verificationMethod,
  verificationCode,
  name,
  email,
  res
) {
  try {
    if (verificationMethod === "email") {
      await sendEmail({
        email,
        subject: "Chat App Email Verification Code",
        message: `Hello ${name}, your verification code is ${verificationCode}. This code is valid for 5 minutes.`,
      });

      res.status(201).json({
        success: true,
        message: `Verification code sent to ${email}. Please check your inbox.`,
        verificationMethod,
        email,
      });
    } else if (verificationMethod === "phone") {
      await client.messages.create({
        body: `Chat App: Your verification code is ${verificationCode}. This code is valid for 5 minutes.`,
        to: email,
        from: process.env.TWILIO_PHONE_NUMBER || "+12345678901",
      });

      res.status(201).json({
        success: true,
        message: `Verification code sent to your phone number. Please check your messages.`,
        verificationMethod,
        email,
      });
    }
  } catch (error) {
    throw new ErrorHandler(
      `Failed to send verification code: ${error.message}`,
      500
    );
  }
}

export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  try {
    const userAllEntries = await User.find({
      $or: [
        {
          email,
          accountVerified: false,
        },
      ],
    }).sort({ createdAt: -1 });

    if (!userAllEntries) {
      return next(new ErrorHandler("User not found.", 404));
    }

    let user;

    if (userAllEntries.length > 1) {
      user = userAllEntries[0];

      await User.deleteMany({
        _id: { $ne: user._id },
        $or: [{ email, accountVerified: false }],
      });
    } else {
      user = userAllEntries[0];
    }

    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("Invalid OTP.", 400));
    }

    const currentTime = Date.now();

    const verificationCodeExpire = new Date(
      user.verificationCodeExpire
    ).getTime();

    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP has expired.", 400));
    }

    user.accountVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpire = undefined;
    await user.save();

    const token = user.getJWTToken();

    sendToken(user, token, res, "Account verified successfully.");
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Email and password are required.", 400));
  }

  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );

  if (!user) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }

  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }

  sendToken(user, 200, "Login successful.", res);
});

export const logout = catchAsyncError(async (req, res, next) => {
  if (req.user && req.user._id) {
    try {
      await User.findByIdAndUpdate(req.user._id, {
        status: "offline",
        lastSeen: new Date(),
      });
    } catch (error) {
      console.error("Failed to update user status on logout:", error);
    }
  }

  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });
});

export const getMyProfile = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    user,
  });
});

export const updateUserStatus = catchAsyncError(async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new ErrorHandler("Status is required", 400));
  }

  if (!["online", "offline", "away"].includes(status)) {
    return next(new ErrorHandler("Invalid status value", 400));
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      status,
      lastSeen:
        status === "offline" ? new Date().toISOString() : req.user.lastSeen,
    },
    { new: true }
  );

  console.log(`User ${req.user._id} status updated to ${status}`);

  res.status(200).json({
    success: true,
    message: "User status updated successfully",
    user: updatedUser,
  });
});

export const getUser = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;
  const message = `Your Reset Password Token is:- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then please ignore it.`;

  try {
    sendEmail({
      email: user.email,
      subject: "aiChat RESET PASSWORD",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ErrorHandler(
        error.message ? error.message : "Cannot send reset password token.",
        500
      )
    );
  }
});

export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(
      new ErrorHandler(
        "Reset password token is invalid or has been expired.",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Password & confirm password do not match.", 400)
    );
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendToken(user, 200, "Reset Password Successfully.", res);
});

export const getAllUsers = catchAsyncError(async (req, res, next) => {
  const users = await User.find({
    _id: { $ne: req.user._id },
  }).select(
    "-password -verificationCode -verificationCodeExpire -resetPasswordToken -resetPasswordExpire"
  );
  res.status(200).json({ success: true, users: users || [] });
});

export const searchUsers = catchAsyncError(async (req, res, next) => {
  const { q } = req.query;
  if (!q || q.trim() === "") {
    return res.status(200).json({ success: true, users: [] });
  }
  const users = await User.find({
    _id: { $ne: req.user._id },
    name: { $regex: q, $options: "i" },
    accountVerified: true,
  }).select(
    "-password -verificationCode -verificationCodeExpire -resetPasswordToken -resetPasswordExpire"
  );
  res.status(200).json({ success: true, users: users || [] });
});

export const getOnlineUsers = catchAsyncError(async (req, res, next) => {
  const onlineUsers = await User.find({ status: "online" }).select(
    "name email avatar status lastSeen"
  );

  res.status(200).json({
    success: true,
    users: onlineUsers,
  });
});

export const updateProfile = catchAsyncError(async (req, res, next) => {
  try {
    const { name, bio, location, interests } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (interests) {
      user.interests = Array.isArray(interests)
        ? interests
        : interests.split(",").map((item) => item.trim());
    }

    if (req.file) {
      if (user.avatar && user.avatar.startsWith("./public")) {
        try {
          fs.unlinkSync(user.avatar);
        } catch (err) {
          console.log("Error deleting old avatar:", err);
        }
      }
      user.avatar = `/public/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    if (global.io) {
      global.io.emit("user-profile-updated", {
        userId: user._id,
        name: user.name,
        bio: user.bio,
        location: user.location,
        interests: user.interests,
        avatar: user.avatar,
        updatedAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        interests: user.interests,
      },
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

export const followUser = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;

  const userToFollow = await User.findById(userId);
  if (!userToFollow) {
    return next(new ErrorHandler("User not found", 404));
  }

  const currentUser = await User.findById(req.user._id);
  if (currentUser.following && currentUser.following.includes(userId)) {
    return next(new ErrorHandler("You already follow this user", 400));
  }

  await User.findByIdAndUpdate(req.user._id, { $push: { following: userId } });

  await User.findByIdAndUpdate(userId, { $push: { followers: req.user._id } });

  if (io) {
    io.emit("follow-notification", {
      userId,
      follower: {
        _id: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar,
      },
      timestamp: new Date(),
    });
  }

  res.status(200).json({
    success: true,
    message: "User followed successfully",
  });
});

export const unfollowUser = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;

  const userToUnfollow = await User.findById(userId);
  if (!userToUnfollow) {
    return next(new ErrorHandler("User not found", 404));
  }

  const currentUser = await User.findById(req.user._id);
  if (!currentUser.following || !currentUser.following.includes(userId)) {
    return next(new ErrorHandler("You don't follow this user", 400));
  }

  await User.findByIdAndUpdate(req.user._id, { $pull: { following: userId } });

  await User.findByIdAndUpdate(userId, { $pull: { followers: req.user._id } });

  res.status(200).json({
    success: true,
    message: "User unfollowed successfully",
  });
});

export const getFollowers = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate(
    "followers",
    "name email avatar status lastSeen bio"
  );

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    followers: user.followers || [],
  });
});

export const getFollowing = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate(
    "following",
    "name email avatar status lastSeen bio"
  );

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    following: user.following || [],
  });
});

export const getSuggestedUsers = catchAsyncError(async (req, res, next) => {
  const currentUser = await User.findById(req.user._id);
  if (!currentUser) {
    return next(new ErrorHandler("User not found", 404));
  }

  const following = currentUser.following || [];

  const suggestedUsers = await User.find({
    _id: { $nin: [...following, req.user._id] },
    accountVerified: true,
  })
    .select("name email avatar bio status lastSeen")
    .limit(5);

  res.status(200).json({
    success: true,
    users: suggestedUsers,
  });
});

export const getUserProfile = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select(
    "-password -verificationCode -verificationCodeExpire -resetPasswordToken -resetPasswordExpire"
  );

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    user,
  });
});

export const updatePassword = catchAsyncError(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(
      new ErrorHandler("Please provide current and new password", 400)
    );
  }

  const user = await User.findById(req.user._id).select("+password");

  const isPasswordMatched = await user.comparePassword(currentPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Current password is incorrect", 400));
  }

  user.password = newPassword;
  await user.save();

  sendToken(user, 200, "Password updated successfully", res);
});
