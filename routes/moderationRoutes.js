import express from "express";

import {
    getReportedMessages,
    getReportedUsers,
    handleReport,
} from "../controllers/moderationController.js";

import { isAuthenticated, isAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.get("/reported-messages", isAuthenticated, isAdmin, getReportedMessages);
router.get("/reported-users", isAuthenticated, isAdmin, getReportedUsers);
router.post("/report", isAuthenticated, handleReport);

export default router;
