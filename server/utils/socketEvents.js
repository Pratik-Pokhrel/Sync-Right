// single source file for all Socket.io event names

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
  CHAT_HISTORY: "chat:history", // initial history sent on room:join

  // ------------ WebRTC (client -> server) ----------- //
  WEBRTC_JOIN: "webrtc:join", // join the call inside a room
  WEBRTC_LEAVE: "webrtc:leave", // leave the call(explicit)
  WEBRTC_OFFER: "webrtc:offer", // relay SDP offer to a specific peer
  WEBRTC_ANSWER: "webrtc:answer", // relay SDP answer to specific peer
  WEBRTC_ICE_CANDIDATE: "webrtc:ice-candidate", // relay ICE candidate to specific peer
  // All these ABOVE events are reused but in opposite directions ( i.e server -> client )

  // --------- WebRTC ( client -> server ) ---------- //
  WEBRTC_EXISTING_PEERS: "webrtc:existing-peers", // list of peers already in the call (sent to the joiner/participant)
  WEBRTC_PEER_JOINED: "webrtc:peer-joined", // broadcast: a new peer entered the call
  WEBRTC_PEER_LEFT: "webrtc:peer-left", // broadcast: a peer left the call
  WEBRTC_ERROR: "webrtc:error", // error back to the offending socket only
};
