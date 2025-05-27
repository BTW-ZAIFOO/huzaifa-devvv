import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { Message } from "../models/messageModel.js";
import { Chat } from "../models/chatModel.js";
import { User } from "../models/userModal.js";
import { moderateContent, transcribeAudio } from "../utils/openaiService.js";
import { io } from "../app.js";

export const sendMessage = catchAsyncError(async (req, res, next) => {
    const { chatId, recipientId, content } = req.body;
    const isVoiceMessage = req.file ? true : false;

    if ((!chatId && !recipientId) || (!content && !req.file)) {
        return next(
            new ErrorHandler(
                "Chat ID or recipient ID is required, along with content or voice message",
                400
            )
        );
    }

    let chat;

    if (chatId) {
        chat = await Chat.findById(chatId);
        if (!chat) {
            return next(new ErrorHandler("Chat not found", 404));
        }

        if (!chat.participants.map(id => id.toString()).includes(req.user._id.toString())) {
            return next(new ErrorHandler("Access denied", 403));
        }

        if (chat.isBlocked) {
            return next(new ErrorHandler("This chat has been blocked", 403));
        }
    } else {

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return next(new ErrorHandler("Recipient not found", 404));
        }

        chat = await Chat.findOne({
            participants: { $all: [req.user._id, recipientId] },
        });

        if (!chat) {
            chat = await Chat.create({
                participants: [req.user._id, recipientId],
            });
        }
    }

    let messageContent = content;
    let voiceTranscription = null;
    let moderationResult = { flagged: false };

    if (isVoiceMessage) {

        voiceTranscription = await transcribeAudio(req.file.buffer);
        messageContent = voiceTranscription;

        moderationResult = await moderateContent(voiceTranscription);
    } else {

        moderationResult = await moderateContent(content);
    }

    let recipientUser = chat.participants.find(
        (id) => id.toString() !== req.user._id.toString()
    );

    if (!recipientUser) {
        recipientUser = req.user._id;
    }

    const message = await Message.create({
        chat: chat._id,
        sender: req.user._id,
        recipient: recipientUser,
        content: messageContent,
        isVoice: isVoiceMessage,
        voiceTranscription,
        moderationResult,
    });

    chat.lastMessage = message._id;
    await chat.save();

    const populatedMessage = await Message.findById(message._id).populate(
        "sender",
        "name avatar"
    );

    io.to(chat._id.toString()).emit("new-message", populatedMessage);

    res.status(201).json({
        success: true,
        message: populatedMessage,
        moderationResult,
        chatId: chat._id,
    });
});

export const getMessages = catchAsyncError(async (req, res, next) => {
    const { chatId } = req.params;
    const messages = await Message.find({ chat: chatId }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, messages });
});

export const deleteMessage = catchAsyncError(async (req, res, next) => {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
        return next(new ErrorHandler("Message not found", 404));
    }

    if (
        message.sender.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
    ) {
        return next(new ErrorHandler("Access denied", 403));
    }

    message.status = "deleted";
    message.content = "This message has been deleted";
    await message.save();

    io.to(message.sender.toString()).emit("message-deleted", messageId);
    io.to(message.recipient.toString()).emit("message-deleted", messageId);

    res.status(200).json({
        success: true,
        message: "Message deleted successfully",
    });
});

export const reportMessage = catchAsyncError(async (req, res, next) => {
    const { messageId } = req.params;
    const { reason } = req.body;

    if (!reason) {
        return next(new ErrorHandler("Report reason is required", 400));
    }

    const message = await Message.findById(messageId);
    if (!message) {
        return next(new ErrorHandler("Message not found", 404));
    }

    message.isReported = true;
    message.reportReason = reason;
    await message.save();

    const sender = await User.findById(message.sender);
    if (sender) {
        sender.moderationScore += 1;

        if (sender.moderationScore >= 5) {
            sender.status = "banned";
        }

        await sender.save();
    }

    res.status(200).json({
        success: true,
        message: "Message reported successfully",
    });
});

export const markAsRead = catchAsyncError(async (req, res, next) => {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
        return next(new ErrorHandler("Message not found", 404));
    }

    if (message.recipient.toString() !== req.user._id.toString()) {
        return next(new ErrorHandler("Access denied", 403));
    }

    message.readStatus = true;
    message.status = "read";
    await message.save();

    io.to(message.sender.toString()).emit("message-read", messageId);

    res.status(200).json({
        success: true,
        message: "Message marked as read",
    });
});

export const getAllMessages = catchAsyncError(async (req, res, next) => {
    const { limit = 50, page = 1 } = req.query;

    const skip = (page - 1) * limit;
    const messages = await Message.find()
        .populate("sender", "name email avatar")
        .populate("recipient", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments();

    res.status(200).json({
        success: true,
        messages,
        totalMessages,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
    });
});
