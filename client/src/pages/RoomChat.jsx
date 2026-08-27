import { startTransition, useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { connectSocket } from "../utils/socket";
import { tokenStorage } from "../utils/tokenStorage";
import useChat from "../hooks/useChat";
import useWebRTC from "../hooks/useWebRTC";
import useWhiteboard from "../hooks/useWhiteboard";
import ChatPanel from "../components/chat/ChatPanel";
import CallPanel from "../components/chat/CallPanel";
import WhiteboardPanel from "../components/whiteboard/WhiteboardPanel";
import api from "../utils/api";

const RoomChat = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const roomName = location.state?.roomName || "Chat";

  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);

  // inSession = the user has clicked "Join Session" and the call is live.
  // Everything else (chat drawer, whiteboard pin) only exists inside a session.
  const [inSession, setInSession] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (token) {
      const nextSocket = connectSocket(token);
      startTransition(() => setSocket(nextSocket));
    }
  }, []);

  useEffect(() => {
    api
      .get(`/rooms/${roomId}`)
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
    error: chatError,
    connected,
    secureReady,
  } = useChat(roomId, socket);

  const {
    isConnecting,
    error: callError,
    localStream,
    remoteParticipants,
    audioEnabled,
    videoEnabled,
    connectionState,
    currentUserName,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
  } = useWebRTC(roomId, socket);

  // Only join the whiteboard channel once the session is actually live,
  // otherwise the board tries to sync before anyone's in a call.
  const {
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
  } = useWhiteboard(inSession ? roomId : null, socket);

  const handleJoinSession = async () => {
    setInSession(true);
    await joinCall();
  };

  const handleLeaveSession = () => {
    if (isHost && isShared) emitShareStop();
    leaveCall();
    setChatOpen(false);
    setInSession(false);
  };

  if (!socket) {
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
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />

      {/* Header */}
      <div className="relative z-30 flex items-center justify-between border-b border-white/20 bg-white/5 backdrop-blur-md px-6 py-3">
        <Link
          to="/rooms"
          className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
        >
          ← Back to Rooms
        </Link>
        <h1 className="text-lg font-semibold text-white">{roomName || "Chat"}</h1>

        {inSession ? (
          <div className="flex items-center gap-2">
            {isHost && (
              <button
                type="button"
                onClick={() => (isShared ? emitShareStop() : emitShareStart())}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isShared
                    ? "bg-violet-500 text-white hover:bg-violet-400"
                    : "border border-violet-400/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
                }`}
              >
                {isShared ? "Stop Sharing" : "Share Whiteboard"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setChatOpen((prev) => !prev)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                chatOpen
                  ? "bg-cyan-500 text-slate-950"
                  : "border border-cyan-400/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={handleLeaveSession}
              className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25"
            >
              Leave Session
            </button>
          </div>
        ) : (
          <div className="w-24" />
        )}
      </div>

      {/* Content area */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {!inSession ? (
          <div className="flex h-full items-center justify-center p-4">
            <div className="max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-3xl">
              <h2 className="mb-2 text-2xl font-semibold text-white">
                {room?.name || roomName}
              </h2>
              <p className="mb-6 text-sm text-slate-300">
                Start the call to join everyone already in this room. Chat and the
                whiteboard are available once you are in the session.
              </p>
              <button
                type="button"
                onClick={handleJoinSession}
                className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
              >
                Join Session
              </button>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            {/* Call runs in the background for the whole session, whether or not the whiteboard is pinned */}
            <CallPanel
              isConnecting={isConnecting}
              error={callError}
              localStream={localStream}
              remoteParticipants={remoteParticipants}
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              connectionState={connectionState}
              currentUserName={currentUserName}
              toggleAudio={toggleAudio}
              toggleVideo={toggleVideo}
              pinned={isShared}
            />

            {/* Whiteboard pins on top of the call for every participant when the host shares it */}
            {isShared && (
              <div className="absolute inset-x-0 top-0 z-10 flex h-[calc(100%-140px)] flex-col p-4">
                <div className="mb-2 text-center text-xs text-slate-400">
                  {sharedBy?.username
                    ? `${sharedBy.username} is sharing the whiteboard`
                    : "Whiteboard shared"}
                </div>
                <div className="flex-1 min-h-0">
                  <WhiteboardPanel
                    isHost={isHost}
                    strokes={strokes}
                    activeStrokes={activeStrokes}
                    emitStroke={emitStroke}
                    emitDrawing={emitDrawing}
                    emitUndo={emitUndo}
                    emitClear={emitClear}
                  />
                </div>
              </div>
            )}

            {/* Chat slides in as an overlay, the call keeps running underneath */}
            {chatOpen && (
              <div className="absolute right-0 top-0 z-20 h-full w-full max-w-sm border-l border-white/20 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-2xl sm:w-96">
                <ChatPanel
                  messages={messages}
                  typingUsers={typingUsers}
                  sendMessage={sendMessage}
                  onTyping={onTyping}
                  loadOlder={loadOlder}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  error={chatError}
                  connected={connected}
                  secureReady={secureReady}
                  roomName={roomName}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomChat;