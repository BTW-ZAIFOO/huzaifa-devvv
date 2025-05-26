import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { moderateContent, transcribeAudio, getSuggestion } from "../utils/openaiService.js";
import { Message } from "../models/messageModel.js";
import { User } from "../models/userModal.js";

// Moderate text content
export const moderateText = catchAsyncError(async (req, res, next) => {
    const { text } = req.body;

    if (!text) {
        return next(new ErrorHandler("Text content is required", 400));
    }

    const moderationResult = await moderateContent(text);

    // Return the moderation result
    res.status(200).json({
        success: true,
        result: moderationResult,
    });
});

// Transcribe voice message
export const transcribeVoice = catchAsyncError(async (req, res, next) => {
    if (!req.file) {
        return next(new ErrorHandler("Audio file is required", 400));
    }

    // Get audio buffer
    const audioBuffer = req.file.buffer;

    // Call OpenAI to transcribe
    const transcription = await transcribeAudio(audioBuffer);

    // Moderate the transcribed text
    const moderationResult = await moderateContent(transcription);

    res.status(200).json({
        success: true,
        transcription,
        moderationResult,
    });
});

// Get AI-powered reply suggestions
export const getReplyRecommendations = catchAsyncError(async (req, res, next) => {
    const { conversation } = req.body;

    if (!conversation) {
        return next(new ErrorHandler("Conversation context is required", 400));
    }

    // Get AI suggestion for reply
    const suggestion = await getSuggestion(conversation);

    res.status(200).json({
        success: true,
        suggestion,
    });
});

// Get all reported messages (admin only)
export const getReportedMessages = catchAsyncError(async (req, res, next) => {
    const reportedMessages = await Message.find({ isReported: true })
        .populate("sender", "name email avatar")
        .populate("recipient", "name email avatar")
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        reportedMessages,
    });
});

// Get all reported users (admin only)
export const getReportedUsers = catchAsyncError(async (req, res, next) => {
    const reportedUsers = await User.find({ isReported: true })
        .select("name email avatar phone status reportReasons flaggedWords");

    res.status(200).json({
        success: true,
        reportedUsers,
    });
});

// Handle report (message or user)
export const handleReport = catchAsyncError(async (req, res, next) => {
    const { type, id, reason } = req.body;

    if (!type || !id || !reason) {
        return next(
            new ErrorHandler("Report type, ID, and reason are required", 400)
        );
    }

    // Handle report based on type
    if (type === "message") {
        // Report a message
        const message = await Message.findById(id);

        if (!message) {
            return next(new ErrorHandler("Message not found", 404));
        }

        message.isReported = true;
        message.reportReason = reason;
        await message.save();

        // Update user's moderation score
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
    }
    else if (type === "user") {
        // Report a user
        const user = await User.findById(id);

        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }

        user.isReported = true;
        if (!user.reportReasons.includes(reason)) {
            user.reportReasons.push(reason);
        }
        user.moderationScore += 2;

        if (user.moderationScore >= 5) {
            user.status = "banned";
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "User reported successfully",
        });
    }
    else {
        return next(new ErrorHandler("Invalid report type", 400));
    }
});
