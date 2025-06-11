import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userModal.js";
import { sendEmail } from "../utilis/sendEmail.js";
import twilio from "twilio";
import { sendToken } from "../utilis/sendToken.js";
import crypto from "crypto";

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
      return next(new ErrorHandler("OTP Expired.", 400));
    }

    user.accountVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpire = null;
    await user.save({ validateModifiedOnly: true });

    sendToken(user, 200, "Account Verified.", res);
  } catch (error) {
    return next(new ErrorHandler("Internal Server Error.", 500));
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

  sendToken(user, 200, "User logged in successfully.", res);
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
    if (interests !== undefined) {
      user.interests = interests
        .split(",")
        .map((interest) => interest.trim())
        .filter(Boolean);
    }

    if (req.file) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    if (req.app.get("io")) {
      req.app.get("io").emit("user-profile-updated", {
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
      user,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

export const updatePassword = catchAsyncError(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return next(new ErrorHandler("All fields are required", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new ErrorHandler("New passwords do not match", 400));
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const isPasswordMatched = await user.comparePassword(oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Old password is incorrect", 400));
  }

  user.password = newPassword;
  await user.save();

  sendToken(user, 200, res, "Password updated successfully");
});

const uploadFileToStorage = async (file) => {
  return { url: file.name };
};
