import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "../utils/socket";

// SOCKET_EVENTS must mirror server/utils/socketEvents.js
const EVENTS = {
  ROOM_JOIN:       "room:join",
  ROOM_LEAVE:      "room:leave",
  ROOM_USER_JOINED:"room:user_joined",
  ROOM_USER_LEFT:  "room:user_left",
  ROOM_ERROR:      "room:error",
  CHAT_MESSAGE:    "chat:message",
  CHAT_HISTORY:    "chat:history",
  CHAT_TYPING:     "chat:typing",
};

const TYPING_DEBOUNCE_MS = 1500; // stop-typing fires after this much inactivity

/**
 * useChat(roomId)
 *
 * Usage:
 *   const { messages, typingUsers, sendMessage, onTyping, error, connected } = useChat(roomId);
 *
 * Prerequisites:
 *   - connectSocket(accessToken) must have been called before this hook mounts
 *   - User must have called POST /rooms/join/:roomId (REST) before this hook mounts
 */
const useChat = (roomId) => {
  const [messages,    setMessages]    = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { userId: username }
  const [error,       setError]       = useState(null);
  const [connected,   setConnected]   = useState(false);

  // Ref to hold the typing debounce timer — doesn't need to trigger re-renders
  const typingTimer = useRef(null);
  const isTyping    = useRef(false);

  const socket = getSocket();

  // ── Join socket room on mount, leave on unmount ──
  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit(EVENTS.ROOM_JOIN, { roomId });
    setConnected(true);

    // ── Listeners ──

    const onHistory = ({ messages }) => {
      setMessages(messages);
    };

    const onMessage = ({ message }) => {
      setMessages((prev) => [...prev, message]);
    };

    const onUserJoined = ({ user, message }) => {
      // System message is already saved to DB by server; just append to UI
      setMessages((prev) => [...prev, message]);
    };

    const onUserLeft = ({ user, message }) => {
      setMessages((prev) => [...prev, message]);
      // Remove from typing list in case they were typing when they left
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[user._id];
        return next;
      });
    };

    const onTyping = ({ user, isTyping }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (isTyping) {
          next[user._id] = user.username;
        } else {
          delete next[user._id];
        }
        return next;
      });
    };

    const onError = ({ message }) => {
      setError(message);
    };

    socket.on(EVENTS.CHAT_HISTORY,     onHistory);
    socket.on(EVENTS.CHAT_MESSAGE,     onMessage);
    socket.on(EVENTS.ROOM_USER_JOINED, onUserJoined);
    socket.on(EVENTS.ROOM_USER_LEFT,   onUserLeft);
    socket.on(EVENTS.CHAT_TYPING,      onTyping);
    socket.on(EVENTS.ROOM_ERROR,       onError);

    return () => {
      // Explicit leave when component unmounts (e.g., navigating away from room page)
      socket.emit(EVENTS.ROOM_LEAVE, { roomId });
      setConnected(false);

      socket.off(EVENTS.CHAT_HISTORY,     onHistory);
      socket.off(EVENTS.CHAT_MESSAGE,     onMessage);
      socket.off(EVENTS.ROOM_USER_JOINED, onUserJoined);
      socket.off(EVENTS.ROOM_USER_LEFT,   onUserLeft);
      socket.off(EVENTS.CHAT_TYPING,      onTyping);
      socket.off(EVENTS.ROOM_ERROR,       onError);
    };
  }, [socket, roomId]);

  // ── sendMessage ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (text) => {
      if (!socket || !text?.trim()) return;
      socket.emit(EVENTS.CHAT_MESSAGE, { roomId, text });

      // Stop typing indicator when message is actually sent
      if (isTyping.current) {
        socket.emit(EVENTS.CHAT_TYPING, { roomId, isTyping: false });
        isTyping.current = false;
      }
      clearTimeout(typingTimer.current);
    },
    [socket, roomId],
  );

  // ── onTyping — call this from the input's onChange ───────────────────────
  // Emits typing:true immediately on first keystroke, then typing:false after
  // TYPING_DEBOUNCE_MS of inactivity. Debounced to avoid emitting on every key.
  const onTyping = useCallback(() => {
    if (!socket) return;

    if (!isTyping.current) {
      isTyping.current = true;
      socket.emit(EVENTS.CHAT_TYPING, { roomId, isTyping: true });
    }

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      socket.emit(EVENTS.CHAT_TYPING, { roomId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [socket, roomId]);

  return {
    messages,
    typingUsers,    // { [userId]: username } — render as "Alice, Bob are typing..."
    sendMessage,
    onTyping,       // attach to <input onChange={onTyping} />
    error,
    connected,
  };
};

export default useChat;
