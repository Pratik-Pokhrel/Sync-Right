import { useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import { getSocket } from "../utils/socket";
import { SOCKET_EVENTS } from "../utils/socketEvents";
import useE2E from "./useE2E";

const TYPING_DEBOUNCE_MS = 1500; // stop-typing fires after this much inactivity
const HISTORY_PAGE_SIZE = 50; // matches the server's default page size

const useChat = (roomId) => {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: username }
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refs hold values that should not trigger re-renders
  const typingTimer = useRef(null);
  const isTyping = useRef(false);
  const rawMessagesRef = useRef([]);
  const resolutionVersion = useRef(0);
  // Track the oldest page we've loaded so loadOlder() can paginate correctly
  const oldestPage = useRef(1);

  const socket = getSocket();

  const {
    ready: e2eReady,
    keysVersion,
    encryptForRoom,
    decryptFromSender,
  } = useE2E(roomId);

  //resolves each message's displayed text -> decrypts if
  // message.encrypted is true, leaves plaintext/system messages as-is
  const resolveMessage = useCallback(
    async (message) => {
      if (!message || message.type === "system" || !message.encrypted) {
        return message;
      }
      const senderId =
        typeof message.sender === "string"
          ? message.sender
          : message.sender?._id;
      const plaintext = await decryptFromSender(message.text, senderId);
      return { ...message, text: plaintext };
    },
    [decryptFromSender],
  );

  const resolveMessageList = useCallback(
    async (list) => Promise.all(list.map(resolveMessage)),
    [resolveMessage],
  );

  const setResolvedMessages = useCallback(
    async (list) => {
      const version = ++resolutionVersion.current;
      rawMessagesRef.current = list;
      const resolved = await resolveMessageList(list);
      if (version === resolutionVersion.current) setMessages(resolved);
    },
    [resolveMessageList],
  );

  const appendResolvedMessage = useCallback(
    async (message) => {
      const current = rawMessagesRef.current;
      if (
        current.some(
          (item) => item._id && message._id && item._id === message._id,
        )
      ) {
        return;
      }
      const nextMessages = [...current, message];
      rawMessagesRef.current = nextMessages;
      await setResolvedMessages(nextMessages);
    },
    [setResolvedMessages],
  );

  // A history message may arrive before the peer key exchange completes.
  // Re-run decryption when a new key is derived, using the untouched payload.
  useEffect(() => {
    if (rawMessagesRef.current.length > 0) {
      setResolvedMessages(rawMessagesRef.current);
    }
  }, [keysVersion, setResolvedMessages]);

  // ------------------ Join socket room on mount, leave on unmount ---------------------//
  useEffect(() => {
    if (!socket || !roomId) return;
    let active = true;

    // ── Listeners ──

    // Server currently emits { message: history[] } — accept either shape
    // so the client keeps working if the server is fixed to { messages }.
    const onHistory = (payload) => {
      const list = payload?.messages ?? payload?.message ?? [];
      if (Array.isArray(list)) setResolvedMessages(list);
      // After the first history page, the oldest loaded page is page 1.
      oldestPage.current = 1;
    };

    const onMessage = ({ message }) => {
      if (message) appendResolvedMessage(message);
    };

    const onUserJoined = ({ message }) => {
      if (message) appendResolvedMessage(message);
    };

    const onUserLeft = ({ user, message }) => {
      if (message) appendResolvedMessage(message);
      // Drop the leaver from the typing list in case they were typing.
      if (user?._id) {
        setTypingUsers((prev) => {
          if (!prev[user._id]) return prev;
          const next = { ...prev };
          delete next[user._id];
          return next;
        });
      }
    };

    const onTyping = ({ user, isTyping: typing }) => {
      if (!user?._id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[user._id] = user.username;
        else delete next[user._id];
        return next;
      });
    };

    const onError = ({ message }) => {
      setError(message || "Unknown socket error");
    };

    const joinRoom = () => {
      socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId });
    };

    const onConnect = () => {
      setConnected(true);
      joinRoom();
    };
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err) => {
      // Most common cause: invalid/expired token during handshake
      setError(err?.message || "Socket connection error");
      setConnected(false);
    };

    socket.on(SOCKET_EVENTS.CHAT_HISTORY, onHistory);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, onMessage);
    socket.on(SOCKET_EVENTS.ROOM_USER_JOINED, onUserJoined);
    socket.on(SOCKET_EVENTS.ROOM_USER_LEFT, onUserLeft);
    socket.on(SOCKET_EVENTS.CHAT_TYPING, onTyping);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onError);
    socket.on(SOCKET_EVENTS.CONNECT, onConnect);
    socket.on(SOCKET_EVENTS.DISCONNECT, onDisconnect);
    socket.on(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);

    // Register listeners before joining so the server's immediate history response is not missed.
    if (socket.connected) {
      queueMicrotask(() => {
        if (active) {
          setConnected(true);
          joinRoom();
        }
      });
    }

    return () => {
      // Explicit leave when the component unmounts (e.g., navigating away
      // from the room page). The server still expects a REST leave for
      // DB-level cleanup -> this is purely the socket channel.
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
      setConnected(false);

      socket.off(SOCKET_EVENTS.CHAT_HISTORY, onHistory);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, onMessage);
      socket.off(SOCKET_EVENTS.ROOM_USER_JOINED, onUserJoined);
      socket.off(SOCKET_EVENTS.ROOM_USER_LEFT, onUserLeft);
      socket.off(SOCKET_EVENTS.CHAT_TYPING, onTyping);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, onError);
      socket.off(SOCKET_EVENTS.CONNECT, onConnect);
      socket.off(SOCKET_EVENTS.DISCONNECT, onDisconnect);
      socket.off(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
      active = false;
    };
  }, [socket, roomId, appendResolvedMessage, setResolvedMessages]);

  // ----------- sendMessage-------------------- //
  const sendMessage = useCallback(
    async (text) => {
      if (!socket || !text?.trim()) return;
      if (!e2eReady) {
        setError("Secure messaging is still initializing. Please try again.");
        return;
      }
      const trimmed = text.trim();

      const encryptedPayload = await encryptForRoom(trimmed);
      if (!encryptedPayload) {
        setError("Unable to encrypt this message. Please try again.");
        return;
      }
      socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
        roomId,
        text: encryptedPayload,
        encrypted: true,
      });

      if (isTyping.current) {
        socket.emit(SOCKET_EVENTS.CHAT_TYPING, { roomId, isTyping: false });
        isTyping.current = false;
      }
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    },
    [socket, roomId, e2eReady, encryptForRoom],
  );

  // onTyping -> wire to <input onChange={onTyping}>
  // Emits typing:true on the first keystroke, then typing:false after
  // TYPING_DEBOUNCE_MS of inactivity. This keeps the network quiet even
  // for fast typers.
  const onTyping = useCallback(() => {
    if (!socket) return;

    if (!isTyping.current) {
      isTyping.current = true;
      socket.emit(SOCKET_EVENTS.CHAT_TYPING, { roomId, isTyping: true });
    }

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      socket.emit(SOCKET_EVENTS.CHAT_TYPING, { roomId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [socket, roomId]);

  // loadOlder ->paginated REST fetch for messages older than the oldest one currently in state. Page numbers are 1-indexed and we always prepend to the existing list.
  const loadOlder = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = oldestPage.current + 1;
      const response = await api.get(`/messages/${roomId}`, {
        params: { page: nextPage, limit: HISTORY_PAGE_SIZE },
      });
      const data = response.data || {};
      const older = data.messages ?? data.message ?? [];
      if (Array.isArray(older) && older.length > 0) {
        setResolvedMessages([...older, ...rawMessagesRef.current]);
        oldestPage.current = nextPage;
      }
      if (typeof data.pagination?.hasMore === "boolean") {
        setHasMore(data.pagination.hasMore);
      } else {
        // No pagination metadata -> assume there is nothing older left.
        setHasMore(false);
      }
    } catch (err) {
      // Don't clobber the existing error state with a pagination failure;
      // just surface it once.
      setError(err.response?.data?.message || "Failed to load older messages");
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, loadingMore, hasMore, setResolvedMessages]);

  return {
    messages,
    typingUsers, // { [userId]: username } -> render as "Alice, Bob are typing..."
    sendMessage,
    onTyping, // attach to <input onChange={onTyping} />
    loadOlder, // call to fetch the previous page of history
    hasMore, // whether an older page is available
    loadingMore,
    error,
    connected,
  };
};

export default useChat;
