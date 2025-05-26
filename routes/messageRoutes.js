import express from "express";
import { isAuthenticated, isAdmin } from "../middlewares/auth.js";
import {
    sendMessage,
    getMessages,
    deleteMessage,
    reportMessage,
    markAsRead,
    getAllMessages
} from "../controllers/messageController.js";
import multer from "multer";

// Configure multer storage for voice messages
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

// Message routes
router.post("/send", isAuthenticated, upload.single("voiceMessage"), sendMessage);
router.get("/:chatId", isAuthenticated, getMessages);
router.delete("/:messageId", isAuthenticated, deleteMessage);
router.post("/report/:messageId", isAuthenticated, reportMessage);
router.put("/read/:messageId", isAuthenticated, markAsRead);

// Admin routes
router.get("/all", isAuthenticated, isAdmin, getAllMessages);

export default router;
