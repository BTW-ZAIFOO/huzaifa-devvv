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
import { removeUnverifiedAccounts } from "./automation/removeUnverifiedAccounts.js";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";

export const app = express();
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

const uploadsDir = path.join("uploads");
const postsDir = path.join("uploads", "posts");
const avatarsDir = path.join("uploads", "avatars");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir);

app.use("/api/v1/user", userRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/post", postRouter);
app.use("/api/v1/admin", adminRouter);

const server = createServer(app);

export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    console.log(`User left room: ${roomId}`);
  });

  socket.on("join-admin-room", () => {
    socket.join("admin-room");
    console.log("Admin joined admin-room");
  });

  socket.on("admin-delete-message", ({ messageId, chatId }) => {
    io.to(chatId).emit("admin-message-deleted", { messageId });
  });

  socket.on("admin-block-user", ({ userId, notification }) => {
    io.to(userId).emit("admin-user-blocked", notification);
  });

  socket.on("admin-ban-user", ({ userId, notification }) => {
    io.to(userId).emit("admin-user-banned", notification);
  });

  socket.on("admin-send-notification", ({ userId, notification }) => {
    io.to(userId).emit("admin-notification", notification);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

removeUnverifiedAccounts();
connection();

app.use(errorMiddleware);

export { server };
