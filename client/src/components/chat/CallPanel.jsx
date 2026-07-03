import { useEffect, useMemo, useRef } from "react";

// Separate component for each remote participant's video.
// Own ref + own effect = no shared ref-map timing issues.
// Calls .play() explicitly after srcObject assignment to satisfy Chrome's
// autoplay policy for unmuted (audio-bearing) media elements.
const RemoteVideoTile = ({ participant, compact = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !participant.stream) return;

    el.srcObject = participant.stream;

    el.play().catch((err) => {
      if (err.name !== "AbortError") {
        console.warn("[webrtc] remote video autoplay blocked:", err.message);
      }
    });
  }, [participant.stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={compact ? "h-full w-full object-cover" : "h-56 w-full object-cover"}
    />
  );
};

/**
 * CallPanel is mounted once for the entire session (RoomChat controls that),
 * so it has no join/leave button of its own. It renders in two modes:
 *
 * - normal: full video grid, used while nothing is pinned
 * - pinned: a slim strip along the bottom, used while the whiteboard is
 *   being shared, so the call keeps running in the background like a
 *   Meet/Teams screen-share layout
 */
const CallPanel = ({
  isConnecting,
  error,
  localStream,
  remoteParticipants,
  audioEnabled,
  videoEnabled,
  connectionState,
  currentUserName,
  toggleAudio,
  toggleVideo,
  pinned = false,
}) => {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const connectionLabel = useMemo(() => {
    if (isConnecting) return "Connecting…";
    return connectionState || "Connected";
  }, [connectionState, isConnecting]);

  if (pinned) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10 flex h-35 items-center gap-2 overflow-x-auto border-t border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur-xl">
        <div className="relative h-full w-32 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-slate-200">
            {currentUserName} (You)
          </span>
        </div>
        {remoteParticipants.map((participant) => (
          <div
            key={participant.socketId}
            className="relative h-full w-32 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black"
          >
            <RemoteVideoTile participant={participant} compact />
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-slate-200">
              {participant.username}
            </span>
          </div>
        ))}
        <div className="ml-auto flex shrink-0 gap-2 pl-2">
          <button
            type="button"
            onClick={toggleAudio}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
              audioEnabled ? "bg-white/10 text-slate-100" : "bg-rose-500/20 text-rose-200"
            }`}
          >
            {audioEnabled ? "Mute" : "Unmute"}
          </button>
          <button
            type="button"
            onClick={toggleVideo}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
              videoEnabled ? "bg-white/10 text-slate-100" : "bg-rose-500/20 text-rose-200"
            }`}
          >
            {videoEnabled ? "Stop Video" : "Start Video"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2">
        <p className="text-sm text-slate-400">{connectionLabel}</p>
      </div>

      {error ? (
        <div className="border-b border-rose-400/30 bg-rose-500/10 px-5 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
        {/* Local video, must be muted to prevent mic feedback loop */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-slate-300">
            <span>{currentUserName}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">You</span>
          </div>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-56 w-full object-cover"
          />
        </div>

        {remoteParticipants.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-center text-sm text-slate-400">
            No other participants are in the call yet.
          </div>
        ) : (
          remoteParticipants.map((participant) => (
            <div key={participant.socketId} className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-slate-300">
                <span>{participant.username}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Remote</span>
              </div>
              <RemoteVideoTile participant={participant} />
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-white/5 px-5 py-3">
        <button
          type="button"
          onClick={toggleAudio}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            audioEnabled
              ? "bg-white/10 text-slate-100 hover:bg-white/20"
              : "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
          }`}
        >
          {audioEnabled ? "Mute mic" : "Unmute mic"}
        </button>
        <button
          type="button"
          onClick={toggleVideo}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            videoEnabled
              ? "bg-white/10 text-slate-100 hover:bg-white/20"
              : "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
          }`}
        >
          {videoEnabled ? "Stop video" : "Start video"}
        </button>
      </div>
    </div>
  );
};

export default CallPanel;