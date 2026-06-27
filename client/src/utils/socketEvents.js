// Must br the mirror of server/utils/socketEvents.js
// payload is silently dropped on the client.
export const SOCKET_EVENTS = {
  // Native Socket.io
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",

  // Room lifecycle (client -> server)
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",

  // Room lifecycle (server -> client)
  ROOM_USER_JOINED: "room:user_joined",
  ROOM_USER_LEFT: "room:user_left",
  ROOM_ERROR: "room:error",

  // Chat (client -> server)
  CHAT_MESSAGE: "chat:message",
  CHAT_TYPING: "chat:typing",

  // Chat (server -> client)
  CHAT_HISTORY: "chat:history",
};
