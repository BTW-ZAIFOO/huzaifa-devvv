import { server, app, io } from "./app.js";
import { config } from "dotenv";

config({ path: "./config.env" });

app.set("io", io);

server.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
