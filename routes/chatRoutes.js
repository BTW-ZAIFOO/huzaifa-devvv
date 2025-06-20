import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  createChat,
  createOrGetChat,
  getUserChats,
  getChatById,
  blockUnblockChat,
  getAllChats,
  createGroupChat,
  renameGroupChat,
  addToGroupChat,
  removeFromGroupChat,
  getGroupChats,
  getGroupChatById,
  addMultipleUsersToGroup,
} from "../controllers/chatController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createChat);
router.post("/create-or-get", isAuthenticated, createOrGetChat);
router.get("/user", isAuthenticated, getUserChats);
router.get("/:chatId", isAuthenticated, getChatById);
router.put("/block/:chatId", isAuthenticated, blockUnblockChat);
router.get("/", isAuthenticated, getAllChats);
router.post("/group", isAuthenticated, createGroupChat);
router.put("/group/rename", isAuthenticated, renameGroupChat);
router.put("/group/add", isAuthenticated, addToGroupChat);
router.put("/group/remove", isAuthenticated, removeFromGroupChat);
router.get("/group/list", isAuthenticated, getGroupChats);
router.get("/group/:chatId", isAuthenticated, getGroupChatById);
router.put(
  "/group/add-multiple-users",
  isAuthenticated,
  addMultipleUsersToGroup
);

export default router;
