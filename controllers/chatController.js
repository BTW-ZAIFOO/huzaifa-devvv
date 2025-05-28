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

    res.status(201).json({
        success: true,
        chat: newChat,
    });
});

export const createOrGetChat = catchAsyncError(async (req, res, next) => {
    const userId = req.user._id;
    const { recipientId } = req.body;

    if (!recipientId) {
        return res.status(400).json({ success: false, message: "Recipient ID is required" });
    }

    let chat = await Chat.findOne({
        participants: { $all: [userId, recipientId], $size: 2 }
    });

    if (!chat) {
        chat = await Chat.create({
            participants: [userId, recipientId]
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

    if (!chat.participants.some(p => p._id.toString() === req.user._id.toString()))
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
