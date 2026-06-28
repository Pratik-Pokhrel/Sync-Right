import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { connectSocket } from "../utils/socket";
import { tokenStorage } from "../utils/tokenStorage";
import useChat from "../hooks/useChat";
import ChatPanel from "../components/chat/ChatPanel";
import WhiteboardPanel from "../components/whiteboard/WhiteboardPanel";
import api  from "../utils/api";

const TABS = ["Chat", "Whiteboard"];

const RoomChat = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const roomName = location.state?.roomName || "Chat";
  const [socketReady, setSocketReady] = useState(false);
  const [activeTab, setActiveTab] = useState("Chat");
  const [room, setRoom] = useState(null); // CHANGE 1: holds room doc so we can derive isHost

  useEffect(() => {
      const token = tokenStorage.getToken();
      if (token) {
        connectSocket(token);
        setSocketReady(true);
      }
  }, []);

  // fetch room on mount -> gives us room.host._id to compare against current user
  useEffect(() => {
      api.get(`/rooms/${roomId}`)
        .then((res) => setRoom(res.data.room))
        .catch((err) => console.error("[RoomChat] failed to fetch room:", err));
  }, [roomId]);

  const isHost = tokenStorage.getUser()?.id === room?.host?._id;

  const {
    messages,
    typingUsers,
    sendMessage,
    onTyping,
    loadOlder,
    hasMore,
    loadingMore,
    error,
    connected,
  } = useChat(roomId);

  if (!socketReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/15 blur-3xl" />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-slate-300">Initializing connection...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/20 bg-white/5 backdrop-blur-md px-6 py-3">
        <Link
          to="/rooms"
          className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
        >
          ← Back to Rooms
        </Link>
        <h1 className="text-lg font-semibold text-white">{roomName || "Chat"}</h1>
        <div className="flex rounded-xl border border-white/20 bg-white/10 p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-cyan-500 text-white shadow-sm"
                  : "text-slate-200 hover:bg-white/15"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="relative z-10 flex-1 overflow-hidden p-4">
        <div className="mx-auto h-full max-w-5xl">
          {activeTab === "Chat" ? (
            <ChatPanel
              messages={messages}
              typingUsers={typingUsers}
              sendMessage={sendMessage}
              onTyping={onTyping}
              loadOlder={loadOlder}
              hasMore={hasMore}
              loadingMore={loadingMore}
              error={error}
              connected={connected}
              roomName={roomName}
            />
          ) : (
            <WhiteboardPanel roomId={roomId} isHost={isHost}/>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomChat;
