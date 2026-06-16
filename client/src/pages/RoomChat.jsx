import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { connectSocket } from "../utils/socket";
import { tokenStorage } from "../utils/tokenStorage";
import useChat from "../hooks/useChat";
import ChatPanel from "../components/chat/ChatPanel";

const RoomChat = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const roomName = location.state?.roomName || "Chat";
  const [socketReady, setSocketReady] = useState(false);

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (token) {
      connectSocket(token);
      setSocketReady(true);
    }
  }, []);

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
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-amber-50 to-orange-100">
        <p className="text-amber-700">Initializing connection...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-linear-to-br from-amber-50 to-orange-100">
      <div className="flex items-center justify-between border-b border-amber-200 bg-white/80 px-6 py-3 backdrop-blur-sm">
        <Link
          to="/rooms"
          className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-800 transition hover:bg-amber-50"
        >
          &larr; Back to Rooms
        </Link>
      </div>
      <div className="flex-1 p-4">
        <div className="mx-auto h-full max-w-4xl">
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
        </div>
      </div>
    </div>
  );
};

export default RoomChat;
