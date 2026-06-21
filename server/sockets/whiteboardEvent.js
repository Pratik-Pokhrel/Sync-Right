import Room from "../models/Room.js";
import { SOCKET_EVENTS } from "../utils/socketEvents.js";

const MAX_SNAPSHOT_STROKES = 200;

// roomId -> { strokes: Array, userStrokeIds: Map(userId -> [id, ...]) }
const boardState = new Map();

// ----------- Helper Functionsv ------------//
const getBoard = (roomId) => {
  if (!boardsState.has(roomId)) {
    boardState.set(roomId, { strokes: [], userStrokeIds: new Map() });
  }
  return boardState.get(roomId);
};

const isRoomMember = (room, userId) => {
  room.host.equals(userId) || room.participants.some((p) => p.equals(userId));
};

const persist = (roomId, strokes) => {
  Room.findByIdAndUpdate(roomId, { boardSnapShot: strokes }).catch((err) =>
    console.error("[whiteboard] persist error: ", err.message),
  );
};

// ----------Register Function -------//
export const RegisterWhiteboardEvents = (io, socket) => {
  // whiteboard : join -> sends the current snapshot to this socket only
  socket.on(SOCKET_EVENTS.WHITEBOARD_JOIN, async ({ roomId }) => {
    try {
      if (!roomId) return;
      const room = await Room.findById(roomId);

      if (!room || !isRoomMember(room, socket.user._id)) return;

      const board = getBoard(roomId);

      // Cold start / Server restart -> hydrate from DB
      if (board.strokes.length === 0 && room.board.snapshot?.length > 0) {
        board.strokes = [...room.boardsnapshot];
        board.strokes.forEach((s) => {
          if (!board.userStrokeIds.has(s.userId)) {
            board.userStrokeIds.set(s.userId, []);
          }
          board.userStrokeIds.get(s.userId).push(s.id);
        });
      }

      socket.emit(SOCKET_EVENTS.WHITEBOARD_SYNC, { strokes: board.strokes });
    } catch (err) {
      console.error("[whiteboard:join]", err.message);
    }
  });

  // whiteboard:drawing -> in-progress relay only (no DB write)
  socket.on(
    SOCKET_EVENTS.WHITEBOARD_DRAWING,
    ({ roomId, points, tool, color, width }) => {
      if (!roomId || !points) return;
      if (!socket.rooms.has(roomId)) return;

      socket.to(roomId).emit(SOCKET_EVENTS.WHITEBOARD_DRAWING, {
        userId: socket.user._id.toString(),
        username: socket.user.username,
        points,
        tool,
        color,
        width,
      });
    },
  );

  // whiteboard:stroke -> finalized stroke , enrich + broadcast to ALL + persist
  socket.on(SOCKET_EVENTS.WHITEBOARD_STROKE, async ({ roomId, stroke }) => {
    try {
    } catch (err) {
      console.error("[whiteboard:stroke]", err.message);
    }
  });
};
