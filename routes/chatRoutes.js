import express from "express";
import { isAuthenticated, isAdmin } from "../middlewares/auth.js";
import {
    createChat,
    getUserChats,
    getChatById,
    blockUnblockChat,
    getAllChats,
    createOrGetChat
} from "../controllers/chatController.js";

const router = express.Router();

// User chat routes
router.post("/create", isAuthenticated, createOrGetChat);
router.get("/user", isAuthenticated, getUserChats);
router.get("/:chatId", isAuthenticated, getChatById);
router.put("/block/:chatId", isAuthenticated, blockUnblockChat);

// Admin routes
router.get("/all", isAuthenticated, isAdmin, getAllChats);

export default router;
