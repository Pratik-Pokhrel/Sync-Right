import { useEffect, useMemo, useRef } from "react";

// Separate component for each remote participant's video.
// Own ref + own effect = no shared ref-map timing issues.
// Calls .play() explicitly after srcObject assignment to satisfy Chrome's
// autoplay policy for unmuted (audio-bearing) media elements.
const RemoteVideoTile = ({ participant }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !participant.stream) return;

    el.srcObject = participant.stream;

    // autoPlay attribute alone is not enough for unmuted video with audio tracks.
    // Chrome blocks autoplay unless .play() is called explicitly or the element is muted.
    el.play().catch((err) => {
      // AbortError is normal if the component unmounts before play() resolves — safe to ignore.
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
      // No muted — remote participant audio must be audible
      className="h-56 w-full object-cover"
    />
  );
};

const CallPanel = ({
  isJoined,
  isConnecting,
  error,
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
}) => {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const connectionLabel = useMemo(() => {
    if (isConnecting) return "Connecting…";
    if (isJoined) return connectionState || "Connected";
    return "Not in call";
  }, [connectionState, isConnecting, isJoined]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-900/70 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Voice and video</h2>
          <p className="text-sm text-slate-400">{connectionLabel}</p>
        </div>
        <div className="flex gap-2">
          {!isJoined ? (
            <button
              type="button"
              onClick={joinCall}
              className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Join call
            </button>
          ) : (
            <button
              type="button"
              onClick={leaveCall}
              className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25"
            >
              Leave call
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="border-b border-rose-400/30 bg-rose-500/10 px-5 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
        {/* Local video — must be muted to prevent mic feedback loop */}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/5 px-5 py-3">
        <div className="flex gap-2">
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
        <p className="text-sm text-slate-400">Join the room and start a real-time call with other participants.</p>
      </div>
    </div>
  );
};

export default CallPanel;