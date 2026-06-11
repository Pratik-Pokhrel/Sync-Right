import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import User from "../models/User.js";

// Socket.io middleware : runs once per connection before any event handler
// Client must pass the access token in the handshake : socket = io( URL, { token : accessToken } )

export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token; // get the access token from the handshake object if present

    if (!token) {
      return next(new Error("Authentication error: No access token provided"));
    }

    let payload;

    try {
      payload = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
    } catch {
      return next(
        new Error("Authentication error: Invalid or expired access token"),
      );
    }

    const user = await User.findById(payload.id).lean(); // .lean() -> plain JS object, faster and no Mongoose overhead needed here

    if (!user || !user.isActive) {
      return next(
        new Error("Authentication error: User not found or inactive"),
      );
    }

    // Attach the user info to the socket : available as socket.user in all event handlers
    socket.user = { _id: user._id, username: user.username, role: user.role };
    next();
  } catch {
    next(new Error("Authentication error: Internal failure"));
  }
};
