import Room from "../models/Room.js";
import { SOCKET_EVENTS } from "../utils/socketEvents.js";

// In-memory call state -> Why in-memory? : call state remains for a short period, ICE fires 100+ times per pair, so to store each call state in DB would cost too much

const callRooms = new Map(); // callRooms is a Map object, which is a data structure that stores key-value pairs, similar to an object, but it is more efficient and faster than an object for lookup operations. Lookup time : O(1)

// Hard cap for full mesh : N x (N-1) / 2 peer connections per room
// At 8 peers -> 28 connections, 7 per client i.e. safe browser limit
const MAX_CALL_PARTICIPANTS = 8;

// -------------- Helper functions ----------------------//

const getPeers = (roomId) => callRooms.get(roomId) ?? new Map();

const addPeer = (roomId, socketId, info) => {
  if (!callRooms.has(roomId)) callRooms.set(roomId, new Map());
  callRooms.get(roomId).set(socketId, info);
};

const removePeer = (roomId, socketId) => {
  const peers = callRooms.get(roomId);
  if (!peers) return;
  peers.delete(socketId);
  if (peers.size === 0) callRooms.delete(roomId);
};

// This is used by disconnect handler -> if client can't send roomId on unclean disconnect ///
const findPeerRoom = (socketId) => {
  for (const [roomId, peers] of callRooms.entries()) {
    if (peers.has(socketId)) return roomId;
  }
  return null;
};

const isRoomMember = (room, userId) =>
  room.host.equals(userId) || room.participants.some((p) => p.equals(userId));

const emitError = (socket, message) =>
  socket.emit(SOCKET_EVENTS.WEBRTC_ERROR, { message });

// ---Cross-room target validation ---//
//verifies both the sender and the target are registered in callRooms[roomId]
// prevents a socket from relaying SDP/ICE to arbitrary sockets on the server

const assertBothInCall = (roomId, senderSocketId, targetSocketId) => {
  const peers = getPeers(roomId);
  return peers.has(senderSocketId) && peers.has(targetSocketId);
};

// ------ Shared leave logic (explicit leave + disconnect) ---------//

const handlePeerLeave = (io, socket, roomId) => {
  removePeer(roomId, socket.id);

  socket.to(roomId).emit(SOCKET_EVENTS.WEBRTC_PEER_LEFT, {
    socketId: socket.id,
    user: { _id: socket.user._id, username: socket.user.username },
  });

  console.log(
    `[webrtc:leave] user: ${socket.user.username} | room: ${roomId} | remaining: ${getPeers(roomId).size}`,
  );
};

//---------------- Register Function - called once per socket from socketManager.js ----------//
export const registerWebRTCEvents = (io, socket) => {
  // webrtc:join -> pre-condition : REST POST /rooms/join/:roomId must have been called first

  socket.on(SOCKET_EVENTS.WEBRTC_JOIN, async ({ roomId }) => {
    try {
      if (!roomId) return emitError(socket, "roomId is required");

      const room = await Room.findById(roomId);
      if (!room) return emitError(socket, "Room not found");
      if (!isRoomMember(room, socket.user._id)) {
        return emitError(socket, "Join the room first before joining the call");
      }

      const peers = getPeers(roomId);
      if (peers.size >= MAX_CALL_PARTICIPANTS) {
        return emitError(
          socket,
          `Call participants limit reached - maximum of ${MAX_CALL_PARTICIPANTS} allowed`,
        );
      }

      // Stale socket cleanup - same userId, different socketId (reconnect case)
      for (const [sid, info] of peers.entries()) {
        if (info.userId === socket.user._id.toString() && sid !== socket.id) {
          removePeer(roomId, sid);
          console.log(
            `[webrtc:join] removed stale entry for user: ${socket.user.username}`,
          );
        }
      }

      // join the Socket.IO room channel so socket.to(roomId) broadcasts correctly
      // it is idempotent : safe to call even if already joined via chat room:join
      socket.join(roomId);

      const peerInfo = {
        socketId: socket.id,
        userId: socket.user._id.toString(),
        username: socket.user.username,
        mediaState: { audio: true, video: true },
      };
      addPeer(roomId, socket.id, peerInfo);

      // Send the existing peer list to the joiner only
      // Joiner initiates an RTCPeerConnection + offer for each existing peer
      const existingPeers = [...getPeers(roomId).values()].filter(
        (p) => p.socketId !== socket.id,
      );
      socket.emit(SOCKET_EVENTS.WEBRTC_EXISTING_PEERS, {
        peers: existingPeers,
      });

      // notify the exiating peers - they stand by for an incoming offer from this socket
      socket
        .to(roomId)
        .emit(SOCKET_EVENTS.WEBRTC_PEER_JOINED, { peer: peerInfo });

      console.log(
        `[webrtc:join] user: ${socket.user.username} | room: ${roomId} | in call: ${getPeers(roomId).size} / ${MAX_CALL_PARTICIPANTS}`,
      );
    } catch (err) {
      console.log("[webrtc:join] error: ", err.message);
      emitError(socket, "Failed to join call");
    }
  });

  // webrtc:offer -> direction : joiner -> existing peer
  // payload -> { targetSocketId, sdp, roomId } : validates both sockets are in the same call before relaying
  socket.on(SOCKET_EVENTS.WEBRTC_OFFER, ({ targetSocketId, sdp, roomId }) => {
    if (!targetSocketId || !sdp || !roomId) {
      return emitError(socket, "targetSocketId, sdp, and roomId are required");
    }

    if (!assertBothInCall(roomId, socket.id, targetSocketId)) {
      return emitError(
        socket,
        "Invalid target - both peers must be in the same active call",
      );
    }

    io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
      sdp,
      fromSocketId: socket.id,
      from: { _id: socket.user._id, username: socket.user.username },
    });
  });

  // webrtc:answer -> direction : peer -> joiner
  // payload -> { targetSocketId, sdp, roomId } : target receives the offer, creates an answer, here relays it back to the caller
  socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, ({ targetSocketId, sdp, roomId }) => {
    if (!targetSocketId || !sdp || !roomId)
      return emitError(socket, "targetSocketId, sdp, and roomId are required");
    if (!assertBothInCall(roomId, socket.id, targetSocketId))
      return emitError(socket, "Both peers must be in the same active call");

    io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
      sdp,
      fromSocketId: socket.id,
      from: { _id: socket.user._id, username: socket.user.username },
    });
  });

  //webrtc:ice-candidate -> pure-relay, fires 10-200+ times per peer-pair
  // payload : { targetSocketId, canidate, roomId }
  socket.on(
    SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE,
    ({ targetSocketId, candidate, roomId }) => {
      if (!targetSocketId || !candidate || !roomId) return; // silent drop

      if (!assertBothInCall(roomId, socket.id, targetSocketId)) return; // silent drop

      io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
        candidate,
        fromSocketId: socket.id,
      });
    },
  );

  // webrtc:media-state ->User toggles mic/camera : no media touches the server
  // Updates in-memory state so late joiners get correct initial state via EXISTING_PEERS
  // Payload : { roomId, audio: boolean, video: boolean }
  socket.on(SOCKET_EVENTS.WEBRTC_MEDIA_STATE, ({ roomId, audio, video }) => {
    if (!roomId) return emitError(socket, "roomId is required");

    const peer = getPeers(roomId).get(socket.id);
    if (peer) peer.mediaState = { audio: !!audio, video: !!video };

    socket.to(roomId).emit(SOCKET_EVENTS.WEBRTC_MEDIA_STATE, {
      socketId: socket.id,
      user: { _id: socket.user._id, username: socket.user.username },
      audio: !!audio,
      video: !!video,
    });
  });

  // webrtc:leave -> explicit call exit (user clicks "End Call" or something like that kind of button).
  // Socket stays in the Socket.IO room (chat still works); only call state is removed.
  socket.on(SOCKET_EVENTS.WEBRTC_LEAVE, ({ roomId }) => {
    if (!roomId) return emitError(socket, "roomId is required");
    handlePeerLeave(io, socket, roomId);
  });

  // disconnect -> handles browser close/network drop without a clean webrtc:leave.
  // findPeerRoom() locates the room without needing a client-supplied roomId.
  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    const roomId = findPeerRoom(socket.id);
    if (roomId) handlePeerLeave(io, socket, roomId);
  });
};
