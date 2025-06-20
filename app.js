import express from "express";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connection } from "./database/dbConnection.js";
import { errorMiddleware } from "./middlewares/error.js";
import userRouter from "./routes/userRoutes.js";
import chatRouter from "./routes/chatRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import postRouter from "./routes/postRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import searchRouter from "./routes/searchRoutes.js";
import { removeUnverifiedAccounts } from "./automation/removeUnverifiedAccounts.js";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";

const app = express();
config({ path: "./config.env" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use("/uploads", express.static("uploads"));
app.use("/public", express.static("public"));
app.use("/public/uploads", express.static(path.join("public", "uploads")));

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is healthy" });
});

const uploadsDir = path.join("uploads");
const postsDir = path.join("uploads", "posts");
const avatarsDir = path.join("uploads", "avatars");

const publicDir = path.join("public");
const publicUploadsDir = path.join("public", "uploads");
const publicAvatarsDir = path.join("public", "uploads", "avatars");
const publicPostsDir = path.join("public", "uploads", "posts");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir);

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(publicUploadsDir)) fs.mkdirSync(publicUploadsDir);
if (!fs.existsSync(publicAvatarsDir)) fs.mkdirSync(publicAvatarsDir);
if (!fs.existsSync(publicPostsDir)) fs.mkdirSync(publicPostsDir);

app.use("/api/v1/user", userRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/post", postRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/search", searchRouter);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date(),
  });
});

app.use(errorMiddleware);

app.all("*", (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server`,
  });
});

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["polling", "websocket"],
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("authenticate", (userId) => {
    socket.userId = userId;
    socket.join(userId.toString());
    console.log(`User ${userId} authenticated and joined personal room`);
  });

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.userId} joined room: ${roomId}`);

    socket.to(roomId).emit("user-joined-room", {
      userId: socket.userId,
      roomId: roomId,
    });
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user-left-room", {
      userId: socket.userId,
      roomId: roomId,
    });
  });

  socket.on("join-chat-room", (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.userId} joined chat room: ${chatId}`);
  });

  socket.on("typing-start", (data) => {
    socket.to(data.chatId).emit("user-typing", {
      userId: socket.userId,
      chatId: data.chatId,
      isTyping: true,
    });
  });

  socket.on("typing-stop", (data) => {
    socket.to(data.chatId).emit("user-typing", {
      userId: socket.userId,
      chatId: data.chatId,
      isTyping: false,
    });
  });

  socket.on("message-read", (data) => {
    const { chatId, messageId, userId } = data;
    if (chatId) {
      socket.to(chatId).emit("message-read", { messageId, userId });
    }
  });

  socket.on("message-received", (data) => {
    const { chatId, messageId } = data;
    if (chatId) {
      socket.to(chatId).emit("message-delivered", { messageId });
    }
  });

  socket.on("join-admin-room", () => {
    socket.join("admin-room");
    console.log(`Admin joined admin-room: ${socket.id}`);
  });

  socket.on("user-status-change", (data) => {
    io.emit("user-status-updated", data);
  });

  socket.on("follow-user", (data) => {
    io.emit("follow-updated", data);
  });

  socket.on("user-profile-view", (data) => {
    if (data.userId) {
      io.to(data.userId).emit("profile-viewed", {
        viewerId: data.viewerId,
        viewerName: data.viewerName,
        timestamp: new Date(),
      });
    }
  });

  socket.on("post-interaction", (data) => {
    io.emit("post-interaction-update", data);
  });

  socket.on("new-message", (data) => {
    const { chatId, message } = data;

    if (chatId && message && message._id) {
      if (!socket.broadcastedMessages) {
        socket.broadcastedMessages = new Set();
      }

      if (socket.broadcastedMessages.has(message._id)) {
        return;
      }

      socket.broadcastedMessages.add(message._id);

      if (socket.broadcastedMessages.size > 1000) {
        const messagesArray = Array.from(socket.broadcastedMessages);
        socket.broadcastedMessages = new Set(messagesArray.slice(-500));
      }

      socket.to(chatId).emit("new-message", message);
      io.to("admin-room").emit("new-message", message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    if (socket.userId) {
      socket.broadcast.emit("user-disconnected", socket.userId);
    }
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

global.io = io;

removeUnverifiedAccounts();
connection();

try {
  if (fs.existsSync(avatarsDir)) {
    fs.readdirSync(avatarsDir).forEach((file) => {
      const src = path.join(avatarsDir, file);
      const dest = path.join(publicAvatarsDir, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    });
  }
} catch (err) {
  console.error("Error syncing avatar files:", err);
}

export { app, server, io };
