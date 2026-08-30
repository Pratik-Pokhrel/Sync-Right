import Session from "../models/Session.js";
import Room from "../models/Room.js";
import { streamSessionReportPDF } from "../utils/sessionReport.js";
import { generateSessionSummaryFromTranscript } from "../utils/sessionSummary.js";

// GET /sessions/:id (protected)
export const getSessionById = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).lean();

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    const isHost = session.host.toString() === req.user._id.toString();
    const wasParticipant = session.participants.some(
      (p) => p.user.toString() === req.user._id.toString(),
    );

    if (!isHost && !wasParticipant) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
};

// GET /sessions/room/:roomId/active (protected)
/* Allows the client to lookup the session it should use for the "Summarize" button
   without needing to have captured the sessionId at join time
*/

export const getActiveSessionForRoom = async (req, res, next) => {
  try {
    let session = await Session.findOne({
      room: req.params.roomId,
      endTime: null,
    }).sort({ createdAt: -1 });

    if (!session) {
      session = await Session.findOne({ room: req.params.roomId }).sort({
        createdAt: -1,
      });
    }

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "No session found for this room" });
    }

    const isHost = session.host.toString() === req.user._id.toString();
    const wasParticipant = session.participants.some(
      (p) => p.user.toString() === req.user._id.toString(),
    );
    if (!isHost && !wasParticipant) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.status(200).json({ success: true, sessionId: session._id });
  } catch (error) {
    next(error);
  }
};

// POST /sessions/:id/summarize (protected, host only)

export const submitSessionSummary = async (req, res, next) => {
  try {
    const { transcript } = req.body;

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    if (!session.host.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the host can generate a session summary",
      });
    }

    const { summary, actionItems } =
      await generateSessionSummaryFromTranscript(transcript);

    session.summary = summary;
    session.actionItems = actionItems;
    session.summaryGeneratedAt = new Date();
    await session.save();

    return res.status(200).json({ success: true, summary, actionItems });
  } catch (error) {
    next(error);
  }
};

// GET /sessions/:id/report (protected)
export const getSessionReport = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    const room = await Room.findById(session.room);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    const isHost = session.host.equals(req.user._id);
    const wasParticipant = session.participants.some((p) =>
      p.user.equals(req.user._id),
    );
    if (!isHost && !wasParticipant) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    streamSessionReportPDF(res, session, room);
  } catch (error) {
    next(error);
  }
};
