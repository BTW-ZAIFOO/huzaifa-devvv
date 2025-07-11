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
      enum: ["sent", "delivered", "read", "deleted", "permanently_deleted"],
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
    permanentlyDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    messageHash: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

messageSchema.index({ messageHash: 1 }, { unique: true, sparse: true });

export const Message = mongoose.model("Message", messageSchema);
