import Room from "../models/Room.js";
import Session from "../models/Session.js";
import Message from "../models/Message.js";
import { getIO } from "../utils/socketInstance.js";
import { SOCKET_EVENTS } from "../utils/socketEvents.js";

// HELPER FUNCTION
// Fetch a room by ID, throws an error if not found
// select("+password") is called only if password verification is required
const findRoom = async (roomId, selectPassword = false) => {
  // selectPassword: whether to include the password field in the returned room document (for authentication purposes)
  const query = Room.findById(roomId);

  if (selectPassword) query.select("+password"); // Explicitly include the password field if selectPassword is true
  const room = await query;

  if (!room) {
    const err = new Error("Room not found");
    err.statusCode = 404;
    throw err;
  }
  return room;
};

// HELPER FUNCTION

//Takes a populated room doc (host and participants must be populated with at least the "username" field before calling this)
// Returns a clean, consistent response shape used by every endpoint
// 1. roomId - explicit alias for _id (frontend-friendly key)
// 2. host - { _id, username }
// 3. participants - [{ _id, username, isHost, label }]
//    - isHost -> boolean flag for the frontend to use however it wants
//    - label -> "XYZ (host)" for the host, "XYZ" for every participant

const formatRoom = (room) => {
  const hostId = room.host._id.toString(); // room.host is populated, so it's an object

  const participants = room.participants.map((p) => {
    const isHost = p._id.toString() === hostId; // Checks if the current participant is the host

    return {
      _id: p._id,
      username: p.username,
      isHost,
      label: isHost ? `${p.username} (host)` : p.username,
    };
  });

  return {
    _id: room._id,
    roomId: room._id, // explicit alias - frontend uses this to join
    name: room.name,
    host: {
      _id: room.host._id,
      username: room.host.username,
    },
    isPrivate: room.isPrivate,
    maxParticipants: room.maxParticipants,
    isActive: room.isActive,
    participants, // formatted with isHosrt + label
    createdAt: room.createdAt,
  };
};

// HELPER FUNCTION

//Re-queries the room from DB with host + participants populated
// called after any change (create/join/save) so we always format fresh data, not stale in-memory ObjectIds

const populatedRoom = async (roomId) => {
  return Room.findById(roomId)
    .populate("host", "username")
    .populate("participants", "username");
};

// HELPER FUNCTION
// Saves a system message to the DB and broadcasts it to the socket room.
// Called only from joinRoom and leaveRoom — the two true membership-change events.
// This is the single correct place for join/leave announcements; the socket
// ROOM_JOIN / ROOM_LEAVE events are channel-only and must not write these messages.

const emitSystemMessage = async (roomId, senderId, text, socketEvent, user) => {
  const sysMsg = await Message.create({
    room: roomId,
    sender: senderId,
    text,
    type: "system",
  });

  // Populate sender so the client receives the same shape as a regular chat message
  const populated = await Message.findById(sysMsg._id)
    .populate("sender", "username")
    .lean();

  const io = getIO();
  if (io) {
    io.to(roomId.toString()).emit(socketEvent, { user, message: populated });
  }
};

// CREATE ROOM -> POST /rooms/create (protected)

// The authentiated user becomes the host
//If a paswword is provided -> isPrivate = true and the password is hashed by the RoomSchema.ore("save") hook, already defined in Room.js
// The host is NOT added to participants yet — they join the room explicitly via joinRoom, which also creates the Session document.

export const createRoom = async (req, res, next) => {
  try {
    const { name, password, maxParticipants } = req.body;

    const room = await Room.create({
      name,
      host: req.user._id,
      password: password || null, // null = public room
      isPrivate: !!password, // !! converts password to a boolean, true if password is provided, false if not
      maxParticipants,
    });

    // Re-query with populate - Room.create() returns the raw document, host is still an ObjectId at this point
    const populated = await populatedRoom(room._id);

    // // Return room without the password field ( select: flse handles this automatically on create, but we do toObject() for clarity)
    // const safeRoom = room.toObject();
    // delete safeRoom.password; // Ensure password is not sent in the response

    return res.status(201).json({
      success: true,
      message: "Room is created successfully",
      room: formatRoom(populated),

      // participants is [] here (host hasn't joined yet - that's intentional btw
      // The host joins via POST /rooms/join/:roomId after creation)
    });
  } catch (error) {
    next(error);
  }
};

// JOIN A ROOM -> POST /rooms/join/:roomId (protected)

// Steps:
// 1. Finds a room ( with password field selected for verification )
// 2. If room is private, verify the provided password
// 3. Prevent duplicate joins ( user already in participation list cannot join again )
// 4. Checks the participation capacity
// 5. Adds the user to room.participants, mark room isActive = true
// 6. Session logic :
//    - If no active Session exists -> creates one (the created one is the host)
//    - If an active Session exists -> adds this user as participant into it
// 7. System message saved to DB + broadcast via socket (single source of truth for join announcements)
// 8. re-query with populate -> formatRoom -> respond

export const joinRoom = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.roomId, true); // selectPassword = true to include password field for verification

    // Password Check
    if (room.isPrivate) {
      const { password } = req.body;
      if (!password) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: This room requires a password",
        });
      }

      const valid = await room.verifyPassword(password);
      if (!valid) {
        return res.status(403).json({
          success: false,
          message: "Incorrrect room password",
        });
      }
    }

    const userId = req.user._id;

    // Duplicate Join Prevention
    // here participants is an array of ObjectIds; .some() with .equals() does proper ObjectId comparison ( string == ObjectId works but .equals() is safer )

    const alreadyInRoom = room.participants.some((p) => p.equals(userId));
    if (alreadyInRoom) {
      return res.status(409).json({
        // 409 -> conflict
        success: false,
        message: "You are already in this room",
      });
    }

    // Capacity Check
    if (room.participants.length >= room.maxParticipants) {
      return res.status(403).json({
        success: false,
        message: "Room is full, can't join rn",
      });
    }

    // Update Room : add user to participants, mark isActive = true
    room.participants.push(userId);
    room.isActive = true; // Room becomes active on first join
    await room.save(); // Save the updated room document

    // Session Logic
    // Looks for an existing open session (endTime = null -> still active)
    let session = await Session.findOne({ room: room._id, endTime: null });

    if (!session) {
      // No acive session, then this user (or first joiner) becomes the host so creates one
      session = await Session.create({
        room: room._id,
        host: room.host, // the host of the session is always the host of the room ( the one who created the room ), not the joiner
        participants: [{ user: userId, joinedAt: new Date() }],
      });
    } else {
      // If active session exists, then append this participant to that session
      session.participants.push({ user: userId, joinedAt: new Date() });
      await session.save(); // Save the updated session document with the new participant
    }

    // System Message — fires here (REST layer) not in the socket ROOM_JOIN event.
    // socket ROOM_JOIN fires on every chat panel mount (page load, navigation, StrictMode).
    // This REST endpoint is called exactly once per actual membership change, so the
    // "user joined the room" message is written and broadcast exactly once.
    await emitSystemMessage(
      room._id,
      userId,
      `${req.user.username} joined the room`,
      SOCKET_EVENTS.ROOM_USER_JOINED,
      { _id: req.user._id, username: req.user.username, role: req.user.role },
    );

    // re-query with populate so formatRoom has username
    // room.participants at this point is an array of raw ObjectIds (we just pushed userId)
    // We must re-query to get the populated user Objects
    const populated = await populatedRoom(room._id);

    return res.status(200).json({
      success: true,
      message: "Room joined successfully",
      room: formatRoom(populated),
      sessionId: session._id,
    });
  } catch (error) {
    next(error);
  }
};

// LEAVE THE ROOM -> POST /rooms/leave/:roomId (protected)

// Two paths :
// 1. Regular participant leaves -> removed from room.participants, leftAt stamped in the Session participant sub-document
// 2. Host leaves -> same as A, +  session is ended (endSession()), room is marked as isActive = false and participants array is cleared ( room is closed )

export const leaveRoom = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.roomId);
    const userId = req.user._id;

    const inRoom = room.participants.some((p) => p.equals(userId));
    if (!inRoom) {
      return res.status(400).json({
        success: false,
        message: "You are not in this room",
      });
    }

    const isHost = room.host.equals(userId);

    // Stamp leftAt in the session
    const session = await Session.findOne({ room: room._id, endTime: null });

    if (session) {
      const entry = session.participants.find((p) => p.user.equals(userId));
      if (entry) entry.leftAt = new Date();

      if (isHost) {
        // endSession() sets endTime + computes duration, then saves the doc
        // ( instance method defined in Session.js )
        await session.endSession();
      } else {
        await session.save();
      }
    }

    // System Message — broadcast BEFORE updating room.participants below.
    // socket.io channel membership is separate from DB room.participants, so all
    // connected sockets still receive this even after the DB is updated.
    // But emitting first is semantically correct: announce while the room is still live.
    await emitSystemMessage(
      room._id,
      userId,
      isHost
        ? `${req.user.username} (host) closed the room`
        : `${req.user.username} left the room`,
      SOCKET_EVENTS.ROOM_USER_LEFT,
      { _id: req.user._id, username: req.user.username, role: req.user.role },
    );

    // Update the Room
    if (isHost) {
      // Host leaving = room is closed for everyone
      room.participants = [];
      room.isActive = false;
    } else {
      room.participants = room.participants.filter((p) => !p.equals(userId));
      // If the last participant left ( along with the host ), deactivate
      if (room.participants.length === 0) room.isActive = false;
    }

    await room.save(); // Save the updated room document

    return res.status(200).json({
      success: true,
      message: isHost
        ? " Host left - room has been close "
        : "Left the room successfully ",
    });
  } catch (error) {
    next(error);
  }
};

// DELETE A ROOM -> DELETE /rooms/:roomId (protected, host only)

// Permanently deletes the room document and ends any active sessions
// authorization: only the host can delete their own rooms
// No need to use "roleAuthorize" middleware here because this is a resource lvl ownership check ( host of THIS room), not role-level (like admin / user)

export const deleteRoom = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.roomId);

    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the host can delete this room",
      });
    }

    // End any open/active session before deletting the room
    const session = await Session.findOne({ room: room._id, endTime: null });
    if (session) await session.endSession();

    await room.deleteOne(); // Delete the room document

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// LIST THE PUBLIC ROOMS -> GET /rooms (protected)

// Returns all the rooms thar are public ( means isPrivate: false)
// Priivate rooms are discoverable only if the user has the direct access to : roomId + password
// the host is only populated with username (no email or id) and it is displayed in UI as "Hosted by XYZ"
// password is not included by default (select: false in schema) and is never sent in any response

export const listRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({ isPrivate: false })
      .populate("host", "username")
      .populate("participants", "username")
      .sort({ createdAt: -1 }); // Sort rooms by creation date, newest first  [fix: was { created: -1 }, wrong field name]

    return res.status(200).json({
      success: true,
      count: rooms.length,
      rooms: rooms.map(formatRoom), // consistent structure across all the endpoints
    });
  } catch (error) {
    next(error);
  }
};

// GET ROOM BY ID -> GET /rooms/:roomId (protected)

// Any authenticated user can fetch a room's detail ( to preview before joining )
// The password is excluded, used by the frontend to show room info / join screen

export const getRoomById = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate("host", "username")
      .populate("participants", "username");

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    return res.status(200).json({ success: true, room: formatRoom(room) });
  } catch (error) {
    next(error);
  }
};
