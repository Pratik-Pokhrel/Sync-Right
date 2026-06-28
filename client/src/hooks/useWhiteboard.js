import { useState, useEffect, useCallback } from "react";
import { getSocket } from "../utils/socket";
import { SOCKET_EVENTS } from "../utils/socketEvents";

const useWhiteboard = (roomId) => {
  const [strokes, setStrokes] = useState([]);
  const [activeStrokes, setActiveStrokes] = useState({});

  const socket = getSocket();

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit(SOCKET_EVENTS.WHITEBOARD_JOIN, { roomId });

    const onSync = ({ strokes: list }) => {
      setStrokes(Array.isArray(list) ? list : []);
      setActiveStrokes({});
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

    socket.on(SOCKET_EVENTS.WHITEBOARD_SYNC, onSync);
    socket.on(SOCKET_EVENTS.WHITEBOARD_STROKE, onStroke);
    socket.on(SOCKET_EVENTS.WHITEBOARD_DRAWING, onDrawing);
    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, onClear);

    return () => {
      socket.off(SOCKET_EVENTS.WHITEBOARD_SYNC, onSync);
      socket.off(SOCKET_EVENTS.WHITEBOARD_STROKE, onStroke);
      socket.off(SOCKET_EVENTS.WHITEBOARD_DRAWING, onDrawing);
      socket.off(SOCKET_EVENTS.WHITEBOARD_CLEAR, onClear);
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

  return {
    strokes,
    activeStrokes,
    emitStroke,
    emitDrawing,
    emitUndo,
    emitClear,
  };
};

export default useWhiteboard;
