import { useState, useEffect, useCallback } from "react";
import { SOCKET_EVENTS } from "../utils/socketEvents";

// Pass null/undefined for roomId to keep this hook idle (e.g. before the
// user has joined the session) — it will not touch the socket until a real
// roomId is supplied.
const useWhiteboard = (roomId, socket) => {
  const [strokes, setStrokes] = useState([]);
  const [activeStrokes, setActiveStrokes] = useState({});
  const [isShared, setIsShared] = useState(false);
  const [sharedBy, setSharedBy] = useState(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit(SOCKET_EVENTS.WHITEBOARD_JOIN, { roomId });

    const onSync = ({ strokes: list, isShared: shared }) => {
      setStrokes(Array.isArray(list) ? list : []);
      setActiveStrokes({});
      if (typeof shared === "boolean") setIsShared(shared);
    };

    const onStroke = ({ stroke }) => {
      if (!stroke) return;
      setStrokes((prev) =>
        prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke],
      );
      setActiveStrokes((prev) => {
        if (!prev[stroke.userId]) return prev;
        const next = { ...prev };
        delete next[stroke.userId];
        return next;
      });
    };

    const onDrawing = ({ userId, username, points, tool, color, width }) => {
      if (!userId) return;
      setActiveStrokes((prev) => ({
        ...prev,
        [userId]: { username, points, tool, color, width },
      }));
    };

    const onClear = () => {
      setStrokes([]);
      setActiveStrokes({});
    };

    const onShareStart = ({ sharedBy: user }) => {
      setIsShared(true);
      setSharedBy(user || null);
    };

    const onShareStop = () => {
      setIsShared(false);
      setSharedBy(null);
    };

    socket.on(SOCKET_EVENTS.WHITEBOARD_SYNC, onSync);
    socket.on(SOCKET_EVENTS.WHITEBOARD_STROKE, onStroke);
    socket.on(SOCKET_EVENTS.WHITEBOARD_DRAWING, onDrawing);
    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, onClear);
    socket.on(SOCKET_EVENTS.WHITEBOARD_SHARE_START, onShareStart);
    socket.on(SOCKET_EVENTS.WHITEBOARD_SHARE_STOP, onShareStop);

    return () => {
      socket.off(SOCKET_EVENTS.WHITEBOARD_SYNC, onSync);
      socket.off(SOCKET_EVENTS.WHITEBOARD_STROKE, onStroke);
      socket.off(SOCKET_EVENTS.WHITEBOARD_DRAWING, onDrawing);
      socket.off(SOCKET_EVENTS.WHITEBOARD_CLEAR, onClear);
      socket.off(SOCKET_EVENTS.WHITEBOARD_SHARE_START, onShareStart);
      socket.off(SOCKET_EVENTS.WHITEBOARD_SHARE_STOP, onShareStop);
    };
  }, [socket, roomId]);

  const emitStroke = useCallback(
    (stroke) =>
      socket?.emit(SOCKET_EVENTS.WHITEBOARD_STROKE, { roomId, stroke }),
    [socket, roomId],
  );

  const emitDrawing = useCallback(
    (points, tool, color, width) =>
      socket?.emit(SOCKET_EVENTS.WHITEBOARD_DRAWING, {
        roomId,
        points,
        tool,
        color,
        width,
      }),
    [socket, roomId],
  );

  const emitUndo = useCallback(
    () => socket?.emit(SOCKET_EVENTS.WHITEBOARD_UNDO, { roomId }),
    [socket, roomId],
  );

  const emitClear = useCallback(
    () => socket?.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, { roomId }),
    [socket, roomId],
  );

  // Host-only on the server, but safe to expose unconditionally here — the
  // server silently drops the event for non-hosts.
  const emitShareStart = useCallback(
    () => socket?.emit(SOCKET_EVENTS.WHITEBOARD_SHARE_START, { roomId }),
    [socket, roomId],
  );

  const emitShareStop = useCallback(
    () => socket?.emit(SOCKET_EVENTS.WHITEBOARD_SHARE_STOP, { roomId }),
    [socket, roomId],
  );

  return {
    strokes,
    activeStrokes,
    isShared,
    sharedBy,
    emitStroke,
    emitDrawing,
    emitUndo,
    emitClear,
    emitShareStart,
    emitShareStop,
  };
};

export default useWhiteboard;
