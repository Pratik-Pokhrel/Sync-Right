import connectDB from "./config/db.js"; // loads the environment variables
import app from "./app.js";
import http from "http";
import { ENV } from "./config/env.js";
import { initSocket } from "./sockets/socketManager.js";
import { setIO } from "./utils/socketInstance.js";

const server = http.createServer(app);

// Attach Socket.io to the same HTTP server instance
// "io" is the returned in case REST controllers ever need to emit events directly from controllers

export const io = initSocket(server);
setIO(io);

const PORT = ENV.PORT || 8000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
