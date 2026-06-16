import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

let socket = null;

// Call connect(token) after login, disconnect() on logout.
// Returns the same socket if already connected — safe to call multiple times.

export const connectSocket = (accessToken) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token: accessToken }, // picked up by socketAuth middleware on server
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Raw access — only use inside hooks/components after connectSocket() was called
export const getSocket = () => socket;
