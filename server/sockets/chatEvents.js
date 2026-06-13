import Room from "../models/Room.js";
import Message from "../models/Message.js";
import { SOCKET_EVENTS } from "../utils/socketEvents.js";

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
const saveSystsemMessage = async (roomId, senderId, text) => {
  return Message.create({
    room: roomId,
    sender: senderId,
    text,
    type: "system",
  });
};

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

      // Join the Socket.io room channel
      socket.join(roomId); // join the room channel
      socket.currentRoom = roomId; // save the room id to the socket object as a property(currentRoom) so we can use it later

      // ----- Send the message history to this socket only   ---- //

      const history = await Message.find({ room: roomID })
        .populate("sender", "username") // populate the sender field with the username
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean(); // lean() is used to get plain JS object

      socket.emit(SOCKET_EVENTS.CHAT_HISTORY, {
        message: history.reverse(), // return chronological history to the client
      });

      // --- Save + Broadcast join system message --- //
      const sysMsg = await saveSystsemMessage(
        roomId,
        socket.user._id,
        `${socket.user.username} joined the room`,
      );

      // io.to() is used to broadcast to all users in the room
      io.to(roomId).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
        user: socket.user,
        message: sysMsg,
      });
    } catch (err) {
      console.error("[room:join]", err.message);
      socket.emit(SOCKET_EVENTS.ROOM_ERRRR, {
        message: "Failed to join room channel",
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

  // ----------------- room:leave --------------//
  // Explicit leave the room ( user clicked -> "leave room")
  // saves the system message to the DB
  // Client should also call the API DETELE /rooms/leave/:roomId to update the DB state

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, async ({ roomId }) => {
    try {
      if (!roomId) return;

      socket.leave(roomId);

      const sysMsg = await saveSystemMessage(
        roomId,
        socket.user._id,
        `${socket.user.username} left the room`,
      );

      // Broadcast to all the remaining users in the room
      io.to(roomId).emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
        user: socket.user,
        message: sysMsg,
      });

      // Clear the room id from the socket
      socket.currentRoom = null;
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
};
