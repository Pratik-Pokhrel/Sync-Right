import { useEffect, useMemo, useRef, useState } from "react";
import { tokenStorage } from "../../utils/tokenStorage";

const MAX_MESSAGE_LENGTH = 1000; // matches the server-side limit in Message.js

/**
 * Resolve the sender display name from a message object. The server populates
 * `sender` as either a string ObjectId, an object with `username`, or
 * `null` for system messages — handle all three.
 */
const getSenderName = (message) => {
  if (message?.type === "system") return null;
  if (typeof message?.sender === "string") return "Unknown";
  return message?.sender?.username || "Unknown";
};

const getSenderId = (message) => {
  if (!message?.sender) return null;
  if (typeof message.sender === "string") return message.sender;
  return message.sender?._id || null;
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const ChatPanel = ({
  messages,
  typingUsers,
  sendMessage,
  onTyping,
  loadOlder,
  hasMore,
  loadingMore,
  error,
  connected,
  secureReady,
  roomName,
}) => {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const currentUser = useMemo(() => tokenStorage.getUser(), []);
  const currentUserId = currentUser?.id;

  // Auto-scroll to the bottom when new messages arrive, but only if the user is already near the bottom. This prevents yanking the scroll position when someone is reading older messages.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Scroll to bottom on first paint so the most recent messages are visible
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setDraft("");
  };

  const handleInputChange = (e) => {
    setDraft(e.target.value);
    onTyping();
  };

  const typingList = Object.values(typingUsers).filter(Boolean);
  const typingText =
    typingList.length === 0
      ? ""
      : typingList.length === 1
        ? `${typingList[0]} is typing…`
        : typingList.length === 2
          ? `${typingList[0]} and ${typingList[1]} are typing…`
          : `${typingList[0]}, ${typingList[1]} and others are typing…`;

  const canSend = connected && secureReady && draft.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/20 bg-white/10 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 bg-white/5">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {roomName || "Chat"}
          </h2>
          <p className="text-xs text-slate-400">
            {!connected
              ? "Disconnected : trying to reconnect…"
              : secureReady
                ? "Connected"
                : "Connected : securing chat…"}
          </p>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingMore}
            className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load older"}
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-rose-400/30 bg-rose-500/10 px-5 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      {/* Message list */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 space-y-3 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-400">
            No messages yet. Be the first to say hello.
          </p>
        ) : (
          messages.map((message, index) => {
            if (message?.type === "system") {
              return (
                <div
                  key={message._id || `system-${index}`}
                  className="my-2 text-center text-xs italic text-slate-500"
                >
                  {message.text}
                </div>
              );
            }

            const senderId = getSenderId(message);
            const isOwn = senderId && senderId === currentUserId;
            const senderName = getSenderName(message);
            const alignment = isOwn ? "items-end" : "items-start";
            const bubbleColor = isOwn
              ? "bg-cyan-500 text-slate-950 font-medium"
              : "bg-white/10 border border-white/20 text-slate-100";

            return (
              <div key={message._id || `msg-${index}`} className={`flex flex-col ${alignment}`}>
                <div className="text-xs text-slate-400 px-1">
                  {isOwn ? "You" : senderName}
                </div>
                <div
                  className={`mt-1 max-w-[75%] wrap-break-word whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${bubbleColor}`}
                >
                  {message.text}
                </div>
                <div className="text-[10px] text-slate-500 px-1 mt-0.5">
                  {formatTime(message.createdAt)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <div className="min-h-5 px-5 pb-1 text-xs italic text-slate-400">
        {typingText}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-white/20 px-5 py-3 bg-white/5"
      >
        <input
          type="text"
          value={draft}
          onChange={handleInputChange}
          placeholder={
            !connected
              ? "Reconnecting…"
              : secureReady
                ? "Type a message…"
                : "Securing chat…"
          }
          disabled={!connected || !secureReady}
          maxLength={MAX_MESSAGE_LENGTH}
          className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-cyan-500/20"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
