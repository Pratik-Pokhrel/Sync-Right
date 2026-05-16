import connectDB from "./config/db.js"; // loads the environment variables
import app from "./app.js";
import http from "http";
import { ENV } from "./config/env.js";

const server = http.createServer(app);

connectDB().then(() => {
  server.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT}`);
  });
});
