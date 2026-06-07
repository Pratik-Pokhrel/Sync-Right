import Room from "../models/Room.js";
import Session from "../models/Session.js";

// Helper function
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

    // Return room without the password field ( select: flse handles this automatically on create, but we do toObject() for clarity)
    const safeRoom = room.toObject();
    delete safeRoom.password; // Ensure password is not sent in the response

    return res.status(201).json({
      success: true,
      message: "Room is created successfully",
      room: safeRoom,
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
// 4. Checks the participation cap
// 5. Adds the user to room.participants, mark room isActive = true
// 6. Session logic :
//    - If no active Session exists -> creates one (the created one is the host)
//    - If an active Session exists -> adds this user as participant into it

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

    return res.status(200).json({
      success: true,
      message: "Room joined successfully",
      room: {
        _id: room._id,
        name: room.name,
        host: room.host,
        isPrivate: room.isPrivate,
        participants: room.participants,
        maxParticipants: room.maxParticipants,
        isActive: room.isActive,
      },
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
      if (entry) {
        entry.leftAt = new Date();
      }

      if (isHost) {
        // endSession() sets endTime + computes duration, then saves the doc
        // ( instance method defined in Session.js )
        await session.endSession();
      } else {
        await session.save();
      }
    }

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
      .sort({ created: -1 }); // Sort rooms by creation date, newest first

    return res.status(200).json({
      success: true,
      count: rooms.length,
      rooms,
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

    return res.status(200).json({ success: true, room });
  } catch (error) {
    next(error);
  }
};
