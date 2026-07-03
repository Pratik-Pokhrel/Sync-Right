// Must be the mirror of server/utils/socketEvents.js.
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

  // WebRTC
  WEBRTC_JOIN: "webrtc:join",
  WEBRTC_LEAVE: "webrtc:leave",
  WEBRTC_OFFER: "webrtc:offer",
  WEBRTC_ANSWER: "webrtc:answer",
  WEBRTC_ICE_CANDIDATE: "webrtc:ice-candidate",
  WEBRTC_EXISTING_PEERS: "webrtc:existing-peers",
  WEBRTC_PEER_JOINED: "webrtc:peer-joined",
  WEBRTC_PEER_LEFT: "webrtc:peer-left",
  WEBRTC_ERROR: "webrtc:error",
  WEBRTC_MEDIA_STATE: "webrtc:media-state",

  // Whiteboard
  WHITEBOARD_JOIN: "whiteboard:join",
  WHITEBOARD_SYNC: "whiteboard:sync",
  WHITEBOARD_STROKE: "whiteboard:stroke",
  WHITEBOARD_DRAWING: "whiteboard:drawing",
  WHITEBOARD_UNDO: "whiteboard:undo",
  WHITEBOARD_CLEAR: "whiteboard:clear",

  // Whiteboard screen-share style pin (host only, broadcast to whole room)
  WHITEBOARD_SHARE_START: "whiteboard:share_start",
  WHITEBOARD_SHARE_STOP: "whiteboard:share_stop",
};
