import { server } from "./app.js";
import { config } from "dotenv";

config({ path: "./config.env" });

server.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
