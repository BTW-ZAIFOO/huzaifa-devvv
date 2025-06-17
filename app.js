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

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
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
    if (chatId) {
      socket.to(chatId).emit("new-message", message);
    }
  });

  socket.on("message-read", (data) => {
    const { chatId, messageId, userId } = data;
    if (chatId) {
      socket.to(chatId).emit("message-read", { messageId, userId });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
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
