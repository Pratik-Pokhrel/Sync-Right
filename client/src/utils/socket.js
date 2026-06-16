import { io } from "socket.io-client";

// Base URL is shared with the REST client; reuse the same env var so the
// client and socket both point at the same backend in dev and prod.
const SOCKET_URL = import.meta.env.SERVER_API_URL || "http://localhost:8000";

let socket = null;

/**
   Establish a singleton Socket.io connection bound to the current access token.

   Call this right after login (or whenever a token becomes available) and call disconnectSocket() on logout.
   Multiple calls are safe, if a connected socket already exists, it is returned as-is.

   The token is forwarded through the "auth" payload so the server's socketAuth middleware can verify it during the handshake.
 */
export const connectSocket = (accessToken) => {
  if (socket?.connected) return socket;

  // If a socket exists from a previous session but is disconnected (e.g. token refreshed), tear it down so we can build a fresh one with the new token.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socket;
};

// Tear down the socket connection. Safe to call when no socket exists
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

/**
 * Return the live socket instance. Returns null if connectSocket has not
 * been called yet. Only call this from inside components/hooks that have
 * already ensured the connection exists.
 */
export const getSocket = () => socket;
