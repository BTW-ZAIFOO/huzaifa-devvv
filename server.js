import { app, server } from "./app.js";
import { config } from "dotenv";
import { connection } from "./database/dbConnection.js";

config({ path: "./config.env" });

process.on("uncaughtException", (err) => {
  console.log(`ERROR: ${err}`);
  console.log("Shutting down server due to uncaught exception");
  process.exit(1);
});

connection();

const PORT = process.env.PORT || 4000;

if (!server.listening) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO initialized`);
  });
}

process.on("unhandledRejection", (err) => {
  console.log(`ERROR: ${err}`);
  console.log("Shutting down server due to unhandled promise rejection");
  server.close(() => {
    process.exit(1);
  });
});

export default server;
