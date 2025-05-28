import express from "express";
import { isAuthenticated, isAdmin } from "../middlewares/auth.js";
import {
    getUserChats,
    getChatById,
    blockUnblockChat,
    getAllChats,
    createOrGetChat
} from "../controllers/chatController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createOrGetChat);
router.get("/user", isAuthenticated, getUserChats);
router.get("/:chatId", isAuthenticated, getChatById);
router.put("/block/:chatId", isAuthenticated, blockUnblockChat);
router.get("/all", isAuthenticated, isAdmin, getAllChats);

export default router;
