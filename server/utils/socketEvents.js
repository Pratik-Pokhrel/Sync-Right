export const SOCKET_EVENTS = {
  // Native Socket.io
  CONNECTION: "connection", // Client connected to the server
  DISCONNECT: "disconnect", // Client disconnected from the server
  CONNECT_ERROR: "connect_error", // Error connecting to the server

  // Room lifecycle ( client -> server )
  ROOM_JOIN: "room:join", // join the socket room channel
  ROOM_LEAVE: "room:leave", // explicitly leave the socket room channel

  // Room lifecycle ( server -> client )
  ROOM_USER_JOINED: "room:user_joined", // broadcast : someone connected to the channel
  ROOM_USER_LEFT: "room:user_left", // broadcast : someone disconnected/left
  ROOM_ERROR: "room:error", // emit back to the offending socket only

  // Chat ( client -> server )
  CHAT_MESSAGE: "chat:message", // send a new message
  CHAT_TYPING: "chat:typing", // typing indicator on/off

  // chat ( server -> client )
  CHAT_HISTORY: "chat: history", // initial history sent on room:join
};
