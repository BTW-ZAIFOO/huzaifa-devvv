import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { Chat } from "../models/chatModel.js";
import { User } from "../models/userModal.js";

export const createChat = catchAsyncError(async (req, res, next) => {
  const { recipientId } = req.body;

  if (!recipientId) {
    return next(new ErrorHandler("Recipient ID is required", 400));
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    return next(new ErrorHandler("Recipient not found", 404));
  }

  if (recipient.status === "banned") {
    return next(new ErrorHandler("This user has been banned", 403));
  }

  const existingChat = await Chat.findOne({
    participants: { $all: [req.user._id, recipientId] },
  });

  if (existingChat) {
    return res.status(200).json({
      success: true,
      chat: existingChat,
    });
  }

  const newChat = await Chat.create({
    participants: [req.user._id, recipientId],
  });

  return res.status(201).json({
    success: true,
    chat: newChat,
  });
});

export const createOrGetChat = catchAsyncError(async (req, res, next) => {
  const userId = req.user._id;
  const { recipientId } = req.body;

  if (!recipientId) {
    return res
      .status(400)
      .json({ success: false, message: "Recipient ID is required" });
  }

  let chat = await Chat.findOne({
    participants: { $all: [userId, recipientId], $size: 2 },
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [userId, recipientId],
    });
  }

  res.status(200).json({ success: true, chat });
});

export const getUserChats = catchAsyncError(async (req, res, next) => {
  const chats = await Chat.find({
    participants: req.user._id,
  })
    .populate({
      path: "participants",
      select: "name email avatar status lastSeen",
      match: { _id: { $ne: req.user._id } },
    })
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    chats,
  });
});

export const getChatById = catchAsyncError(async (req, res, next) => {
  const { chatId } = req.params;

  const chat = await Chat.findById(chatId)
    .populate("participants", "name email avatar status lastSeen")
    .populate("lastMessage");

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (
    !chat.participants.some((p) => p._id.toString() === req.user._id.toString())
  )
    return next(new ErrorHandler("Access denied", 403));

  res.status(200).json({ success: true, chat });
});

export const blockUnblockChat = catchAsyncError(async (req, res, next) => {
  const { chatId } = req.params;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new ErrorHandler("Chat not found", 404));
  }

  if (!chat.participants.includes(req.user._id)) {
    return next(new ErrorHandler("Access denied", 403));
  }

  chat.isBlocked = !chat.isBlocked;
  chat.blockedBy = chat.isBlocked ? req.user._id : null;

  await chat.save();

  res.status(200).json({
    success: true,
    isBlocked: chat.isBlocked,
    message: `Chat ${chat.isBlocked ? "blocked" : "unblocked"} successfully`,
  });
});

export const getAllChats = catchAsyncError(async (req, res, next) => {
  const chats = await Chat.find()
    .populate("participants", "name email avatar status")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    chats,
  });
});

export const createGroupChat = catchAsyncError(async (req, res, next) => {
  const { name, participants } = req.body;

  if (!name || !participants || !participants.length) {
    return next(
      new ErrorHandler(
        "Please provide a name and at least one participant",
        400
      )
    );
  }

  const allParticipants = [...participants, req.user._id.toString()];
  const uniqueParticipants = [...new Set(allParticipants)];

  if (uniqueParticipants.length < 2) {
    return next(
      new ErrorHandler("Group chat requires at least 2 participants", 400)
    );
  }

  try {
    for (const userId of uniqueParticipants) {
      const userExists = await User.findById(userId);
      if (!userExists) {
        return next(new ErrorHandler(`User with ID ${userId} not found`, 404));
      }

      if (userExists.status === "banned") {
        return next(
          new ErrorHandler(
            `User ${userExists.name} has been banned and cannot be added`,
            403
          )
        );
      }
    }

    const groupChat = await Chat.create({
      isGroupChat: true,
      groupName: name,
      participants: uniqueParticipants,
      groupAdmin: req.user._id,
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate("participants", "name email avatar status")
      .populate("groupAdmin", "name email avatar");

    res.status(201).json({
      success: true,
      chat: fullGroupChat,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});

export const renameGroupChat = catchAsyncError(async (req, res, next) => {
  const { chatId, groupName } = req.body;

  if (!chatId || !groupName) {
    return next(new ErrorHandler("Please provide chat ID and new name", 400));
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { groupName },
    { new: true }
  )
    .populate("participants", "name email avatar status")
    .populate("groupAdmin", "name email avatar");

  if (!updatedChat) {
    return next(new ErrorHandler("Chat not found", 404));
  }

  if (!updatedChat.isGroupChat) {
    return next(new ErrorHandler("This is not a group chat", 400));
  }

  if (updatedChat.groupAdmin.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Only admin can rename the group", 403));
  }

  res.status(200).json({
    success: true,
    chat: updatedChat,
  });
});

export const addToGroupChat = catchAsyncError(async (req, res, next) => {
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return next(new ErrorHandler("Please provide chat ID and user ID", 400));
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new ErrorHandler("Chat not found", 404));
  }

  if (!chat.isGroupChat) {
    return next(new ErrorHandler("This is not a group chat", 400));
  }

  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Only admin can add members", 403));
  }

  if (chat.participants.includes(userId)) {
    return next(new ErrorHandler("User already in the group", 400));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  if (user.status === "banned") {
    return next(
      new ErrorHandler("This user has been banned and cannot be added", 403)
    );
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { $push: { participants: userId } },
    { new: true }
  )
    .populate("participants", "name email avatar status")
    .populate("groupAdmin", "name email avatar");

  res.status(200).json({
    success: true,
    chat: updatedChat,
  });
});

export const removeFromGroupChat = catchAsyncError(async (req, res, next) => {
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return next(new ErrorHandler("Please provide chat ID and user ID", 400));
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new ErrorHandler("Chat not found", 404));
  }

  if (!chat.isGroupChat) {
    return next(new ErrorHandler("This is not a group chat", 400));
  }

  const isAdmin = chat.groupAdmin.toString() === req.user._id.toString();
  const isSelfLeaving = userId === req.user._id.toString();

  if (!isAdmin && !isSelfLeaving) {
    return next(new ErrorHandler("Only admin can remove members", 403));
  }

  if (userId === chat.groupAdmin.toString() && !isSelfLeaving) {
    return next(new ErrorHandler("Group admin cannot be removed", 403));
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { $pull: { participants: userId } },
    { new: true }
  )
    .populate("participants", "name email avatar status")
    .populate("groupAdmin", "name email avatar");

  if (isSelfLeaving && isAdmin && updatedChat.participants.length > 0) {
    updatedChat.groupAdmin = updatedChat.participants[0]._id;
    await updatedChat.save();
  }

  res.status(200).json({
    success: true,
    chat: updatedChat,
  });
});

export const getGroupChats = catchAsyncError(async (req, res, next) => {
  const groupChats = await Chat.find({
    participants: { $elemMatch: { $eq: req.user._id } },
    isGroupChat: true,
  })
    .populate("participants", "name email avatar status")
    .populate("groupAdmin", "name email avatar")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  if (global.io && req.user) {
    global.io
      .to(req.user._id.toString())
      .emit("group-chats-updated", groupChats);
  }

  res.status(200).json({
    success: true,
    groupChats,
  });
});
