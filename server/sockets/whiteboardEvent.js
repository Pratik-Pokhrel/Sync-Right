import Room from "../models/Room.js";
import { SOCKET_EVENTS } from "../utils/socketEvents.js";

const MAX_SNAPSHOT_STROKES = 200;

// roomId -> { strokes: Array, userStrokeIds: Map(userId -> [id, ...]) }
const boardState = new Map();

// ----------- Helper Functionsv ------------//
const getBoard = (roomId) => {
  if (!boardState.has(roomId)) {
    boardState.set(roomId, {
      strokes: [],
      userStrokeIds: new Map(),
      hostId: null,
    });
  }
  return boardState.get(roomId);
};

const isHostUser = (roomId, userId) => {
  const board = boardState.get(roomId);
  return !!board?.hostId && board.hostId === userId.toString();
};

const isRoomMember = (room, userId) => {
  return (
    room.host.equals(userId) || room.participants.some((p) => p.equals(userId))
  );
};

const persist = (roomId, strokes) => {
  Room.findByIdAndUpdate(roomId, { boardSnapshot: strokes }).catch((err) =>
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
      board.hostId = room.host.toString();

      // Cold start / Server restart -> hydrate from DB
      if (board.strokes.length === 0 && room.boardSnapshot?.length > 0) {
        board.strokes = [...room.boardSnapshot];
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
      if (!isHostUser(roomId, socket.user._id)) return;

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
      if (!roomId || !stroke?.points?.length) return;
      if (!socket.rooms.has(roomId)) return;
      if (!isHostUser(roomId, socket.user._id)) return;

      const enriched = {
        ...stroke,
        id: `${socket.id}-${Date.now()}`,
        userId: socket.user._id.toString(),
        username: socket.user.username,
        timestamp: new Date().toISOString(),
      };

      const board = getBoard(roomId);
      board.strokes.push(enriched);

      // per user undo index
      if (!board.userStrokeIds.has(enriched.userId))
        board.userStrokeIds.set(enriched.userId, []);
      board.userStrokeIds.get(enriched.userId).push(enriched.id);

      // Cap at MAX_SNAPSHOT_STROKES (drop oldest)
      if (board.strokes.length > MAX_SNAPSHOT_STROKES) {
        const removed = board.strokes.splice(
          0,
          board.strokes.length - MAX_SNAPSHOT_STROKES,
        );
        const removedIds = new Set(removed.map((s) => s.id));
        for (const [uid, ids] of board.userStrokeIds.entries()) {
          board.userStrokeIds.set(
            uid,
            ids.filter((id) => !removedIds.has(id)),
          );
        }
      }

      // Broadcast confirmed stroke (sender included : triggers main canvas update)
      io.to(roomId).emit(SOCKET_EVENTS.WHITEBOARD_STROKE, { stroke: enriched });
      persist(roomId, board.strokes);
    } catch (err) {
      console.error("[whiteboard:stroke]", err.message);
    }
  });

  // whiteboard: undo -> remove caller's last stroke, broadcast full updated list
  socket.on(SOCKET_EVENTS.WHITEBOARD_UNDO, async ({ roomId }) => {
    try {
      if (!roomId || !socket.rooms.has(roomId)) return;
      if (!isHostUser(roomId, socket.user._id)) return;

      const board = getBoard(roomId);
      const uid = socket.user._id.toString();

      const userIds = board.userStrokeIds.get(uid);
      if (!userIds?.length) return;

      const lastId = userIds.pop();
      board.strokes = board.strokes.filter((s) => s.id !== lastId);

      // Full sync so all clients redraw cleanly
      io.to(roomId).emit(SOCKET_EVENTS.WHITEBOARD_SYNC, {
        strokes: board.strokes,
      });
      persist(roomId, board.strokes);
    } catch (err) {
      console.error("[whiteboard:undo]", err.message);
    }
  });

  // whiteboard:clear -> wipe everything
  socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, async ({ roomId }) => {
    try {
      if (!roomId || !socket.rooms.has(roomId)) return;
      if (!isHostUser(roomId, socket.user._id)) return;

      const board = getBoard(roomId);
      board.strokes = [];
      board.userStrokeIds.clear();

      io.to(roomId).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, {
        clearedBy: { _id: socket.user._id, username: socket.user.username },
      });
      persist(roomId, []);
    } catch (err) {
      console.error("[whiteboard:clear]", err.message);
    }
  });
};
