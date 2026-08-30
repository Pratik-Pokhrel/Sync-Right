import { Server } from "socket.io";
import { ENV } from "../config/env.js";
import { socketAuth } from "../sockets/socketAuth.js";
import { registerChatEvents } from "../sockets/chatEvents.js";
import { SOCKET_EVENTS } from "../utils/socketEvents.js";
import { registerWebRTCEvents } from "../sockets/webrtcSignaling.js";
import { RegisterWhiteboardEvents } from "../sockets/whiteboardEvent.js";

// initializes Socket.io on the provided HTTP server
// returns the "io" instance in case other parts of the app need it ( like emitting from REST controllers )

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://192.168.1.74:5173",
        "http://192.168.1.87:5173",
        "http://192.168.1.92:5173",
        "http://192.168.56.1:5173",
        "http://127.0.0.1:5173",
        "http://192.168.64.1:5173",
        ENV.CLIENT_URL,
      ],
      credentials: true, // required because auth token comes from handshake
    },
    // Optional tunings:
    //pingInterval: 1000,  // ms betwwwn keep-alive pings
    //pingTimeout: 5000,   // ms before considering connection dead
  });

  //----- global auth middleware ---//
  // runs before the CONNECTION fires, rejects unauthenticated sockets immediately
  io.use(socketAuth);

  // -----------  per connection handler ------------//
  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    console.log(
      `[socket] connected | id: ${socket.id} | user: ${socket.user.username}`,
    );

    // Register all chat related events for this socket
    registerChatEvents(io, socket);

    // Register all WebRTC related events for this socket
    registerWebRTCEvents(io, socket);

    // Register all Whiteboard related events for this socket
    RegisterWhiteboardEvents(io, socket);

    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log(
        `[socket] disconnected  | user: ${socket.user.username} | reason: ${reason} | id: ${socket.id}`,
      );
    });
  });
  return io; // returns the "io" instance so that the REST controllers can use it across the app
};
