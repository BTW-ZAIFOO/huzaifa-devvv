import { app, server } from "./app.js";
import { config } from "dotenv";
import { connection } from "./database/dbConnection.js";

config({ path: "./config.env" });

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`ERROR: ${err}`);
  console.log("Shutting down server due to uncaught exception");
  process.exit(1);
});

// Connect to database
connection();

// Start the server - use server from app.js which has Socket.IO attached
const PORT = process.env.PORT || 4000;

// Check if server is already listening (happens when imported elsewhere)
if (!server.listening) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO initialized`);
  });
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log(`ERROR: ${err}`);
  console.log("Shutting down server due to unhandled promise rejection");
  server.close(() => {
    process.exit(1);
  });
});

export default server;
