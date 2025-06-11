import { server } from "./app.js";
import { config } from "dotenv";
import { Server } from "socket.io";

config({ path: "./config.env" });

const io = new Server(server);

// Make the io instance available to your routes for emitting events
app.set("io", io);

// Handle socket connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Join admin room if admin user
  socket.on("join-admin-room", () => {
    socket.join("admin-room");
    console.log(`User joined admin room: ${socket.id}`);
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
