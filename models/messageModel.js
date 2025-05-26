import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        chat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chat",
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        isVoice: {
            type: Boolean,
            default: false,
        },
        voiceTranscription: {
            type: String,
            default: null,
        },
        moderationResult: {
            flagged: { type: Boolean, default: false },
            categories: { type: Object, default: {} },
            categoryScores: { type: Object, default: {} },
        },
        readStatus: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["sent", "delivered", "read", "deleted"],
            default: "sent",
        },
        isReported: {
            type: Boolean,
            default: false,
        },
        reportReason: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

export const Message = mongoose.model("Message", messageSchema);
