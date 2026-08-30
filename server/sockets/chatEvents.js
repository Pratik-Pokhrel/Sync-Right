import Room from "../models/Room.js";
import Message from "../models/Message.js";
import { SOCKET_EVENTS } from "../utils/socketEvents.js";
import { audit } from "../utils/audit.js"; // used for moderation-blocked events

const HISTORY_LIMIT = 50; // number of messages sent to a user on room:join

// -------------- Helper Functions --------------- //

// This function checks the DB to confirm this socket's user is actually a participant or host
// don't trust the client-supplied roomId alone : always verify against the DB

const assertParticipant = async (room, userId) => {
  const isHost = room.host.equals(userId); //
  const isParticipant = room.participants.some((p) => p.equals(userId));
  return isHost || isParticipant;
};

// This function saves a system message and returns it ( used for join/leave announcements )
// const saveSystemMessage = async (roomId, senderId, text) => {
//   return Message.create({
//     room: roomId,
//     sender: senderId,
//     text,
//     type: "system",
//   });
// };

// -------------- Register Chat Events -------------//

// it is called once per socket connection from SocketManager.js
// "io" -> the full server instance ( needed for io.to(room).emit - broadcasts to all(users) in the room )
// "socket" -> this connection (socket.io(room).emit -> broadcasts to all(users) except the sender )

export const registerChatEvents = (io, socket) => {
  // precondition: client must have called POST /rooms/join/:roomId first
  // tThis event connects the 'Socket.io' room channel so that the messages can flow in real time
  // It also sends a recent history and a join announcement

  socket.on(SOCKET_EVENTS.ROOM_JOIN, async ({ roomId }) => {
    try {
      if (!roomId) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: "roomId is required",
        });
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: "Room not found",
        });
      }

      const allowed = await assertParticipant(room, socket.user._id);
      if (!allowed) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message:
            "Join the room first as a participant or host via API (/rooms/join/:roomId) before connecting via socket",
        });
      }

      socket.join(roomId);
      socket.currentRoom = roomId;

      const history = await Message.find({ room: roomId })
        .populate("sender", "username")
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean();

      socket.emit(SOCKET_EVENTS.CHAT_HISTORY, {
        message: history.reverse(),
      });

      // If a "left" announcement is pending from a near-instant rejoin
      // (StrictMode double-effect), cancel it - this socket never really left.
      // if (socket.leaveTimer) {
      //   clearTimeout(socket.leaveTimer);
      //   socket.leaveTimer = null;
      // }

      // // Only announce "joined" if we haven't already announced it for this socket's current room.
      // if (!socket.hasAnnouncedJoin) {
      //   const sysMsg = await saveSystemMessage(
      //     roomId,
      //     socket.user._id,
      //     `${socket.user.username} joined the room`,
      //   );

      //   io.to(roomId).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
      //     user: socket.user,
      //     message: sysMsg,
      //   });

      //   socket.hasAnnouncedJoin = true;
      // }
    } catch (err) {
      console.error("[room:join]", err.message);
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        message: "Failed to join room channel",
      });
    }
  });

  // ----------- chat:message -----------------//

  // After E2E implementation, this event will encrypt the message and payload carries a new parameter "encrypted"
  // when true, 'text' will be a JSON string of { [recipientUserId]: base64(IV+ciphertext) } produced at client side and server stores and relay it as is

  /* Content moderation is deliberately not done here because by the time text arrives at this handler it's already E2E ciphertext
     So the server has nothing readble to classify. That's why moderation runs on the client side
  */
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async ({ roomId, text, encrypted }) => {
    try {
      if (!roomId || !text?.trim()) return;

      // Don't trust the client - confirm this socket is actually in the room
      if (!socket.rooms.has(roomId)) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: "Join the room before sending messages",
        });
      }

      const message = await Message.create({
        room: roomId,
        sender: socket.user._id,
        text: text.trim(),
        type: "text",
        encrypted: !!encrypted,
      });

      const populated = await Message.findById(message._id)
        .populate("sender", "username")
        .lean();

      io.to(roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE, { message: populated });
    } catch (err) {
      console.error("[chat:message]", err.message);
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        message: "Failed to send message",
      });
    }
  });

  // ------------- chat:typing --------- //
  // lighweight event no DB write needed, just relay to others in the room
  // client emmits { roomId, isTyping: true/false  }

  socket.on(SOCKET_EVENTS.CHAT_TYPING, ({ roomId, isTyping }) => {
    if (!roomId) return;

    //socket.to() excludes the sender - no need to see the typing indicator
    socket.to(roomId).emit(SOCKET_EVENTS.CHAT_TYPING, {
      user: socket.user,
      isTyping: !!isTyping, // convert the isTyping value to boolean
    });
  });

  // --------- chat:moderation_blocked ------------------//
  /* Client side moderation blocked a message before it was ever sent/encrypted
    This is an audit-only relay: only category labels are sent, never the message text,
    this doesn't reintroduce a plaintext leak. Reuses the audit() utility
  */
  socket.on(SOCKET_EVENTS.CHAT_MODERATION_BLOCKED, ({ roomId, labels }) => {
    if (!roomId) return;

    audit("chat.moderation_blocked", {
      actor: socket.user._id,
      target: roomId,
      targetModel: "room",
      meta: { labels },
    });
  });

  // ----------------- room:leave --------------//
  // Explicit leave the room ( user clicked -> "leave room")
  // saves the system message to the DB
  // Client should also call the API DETELE /rooms/leave/:roomId to update the DB state

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, async ({ roomId }) => {
    try {
      if (!roomId) return;

      socket.leave(roomId);
      socket.currentRoom = null;

      // if (!socket.hasAnnouncedJoin) return; // never announced, nothing to retract

      // // Delay the "left" announcement slightly. If the socket rejoins
      // // before this fires (StrictMode double-effect), ROOM_JOIN will
      // // cancel this timer and we skip the announcement entirely.
      // socket.leaveTimer = setTimeout(async () => {
      //   const sysMsg = await saveSystemMessage(
      //     roomId,
      //     socket.user._id,
      //     `${socket.user.username} left the room`,
      //   );

      //   io.to(roomId).emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
      //     user: socket.user,
      //     message: sysMsg,
      //   });

      //   socket.hasAnnouncedJoin = false;
      //   socket.leaveTimer = null;
      // }, 300);
    } catch (err) {
      console.error("[room:leave]", err.message);
    }
  });

  // --------disconnect -----------------//
  //  fires on browser close or network error, maybw temporary so do not update the DB
  // just notify the room so that UI can show the "User Disconnected"
  // no db write needed: if the user reconnects quickly, they rejoin without a leave record

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    if (socket.currentRoom) {
      // no await - fire and forget on disconnect

      io.to(socket.currentRoom).emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
        user: socket.user,

        // no db message saved - disconnect is potentially temporary

        message: {
          text: `${socket.user.username} disconnected`,
          type: "system",
          createdAt: new Date(),
        },
      });
    }
  });

  // ------------- E2E key relay ------------------//
  // server is a dumb relay : it never stores, logs, or inspects key material, just forwards JWK public keys
  socket.on(SOCKET_EVENTS.E2E_PUBLIC_KEY, ({ roomId, publicKeyJwk }) => {
    if (!roomId || !publicKeyJwk) return;
    if (!socket.rooms.has(roomId)) return;

    socket.to(roomId).emit(SOCKET_EVENTS.E2E_PEER_KEY, {
      userId: socket.user._id.toString(),
      publicKeyJwk,
    });
  });

  // late joiner asks the existing participants for their keys
  socket.on(SOCKET_EVENTS.E2E_REQUEST_KEYS, ({ roomId }) => {
    if (!roomId) return;
    if (!socket.rooms.has(roomId)) return;

    socket.to(roomId).emit(SOCKET_EVENTS.E2E_KEY_REQUEST, {
      fromUserId: socket.user._id.toString(),
    });
  });
};
