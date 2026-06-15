import Message from "../models/Message.js";
import Meesgae from "../models/Message.js";
import Room from "../models/Room.js";

// GET /messages/:roomId?page=1&limit=50
// protected - only participants and the host can read a room's messages
// Socket already sends the last 50 messages on join; this endpoint covers the pagination
// Other messages are are loaded via a button at the client side

export const getRoomMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    //Authorization
    const room = await Room.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ succes: false, message: "Room not found " }); // hard capacity = 100;
    }

    const isHost = room.host.equals(req.user._id);
    const isParticipant = room.participants.some((p) => p.equals(req.user._id));

    if (!isHost && !isParticipant) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied: Your are not in this room",
        });
    }

    // Pagination //
    const skip = (page - 1) * limit;
    const total = await Message.countDocuments({ room: roomId });

    const messages = await Message.find({ room: roomId })
      .populate("sender", "username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      message: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
};
