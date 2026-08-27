import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api";
import { SOCKET_EVENTS } from "../utils/socketEvents";
import { tokenStorage } from "../utils/tokenStorage";

const useWebRTC = (roomId, socket) => {
  const currentUser = useMemo(() => tokenStorage.getUser(), []);
  const currentUserName = currentUser?.username || "You";

  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState("idle");

  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const peerMetaRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const iceServersRef = useRef([]);
  const joinedRef = useRef(false);
  const pendingOffersRef = useRef(new Set());

  const syncParticipants = useCallback(() => {
    const participants = [];
    peerMetaRef.current.forEach((meta, socketId) => {
      const peerConnection = peerConnectionsRef.current.get(socketId);
      const stream = remoteStreamsRef.current.get(socketId) || null;
      participants.push({
        socketId,
        username: meta?.username || "Remote user",
        stream,
        audioEnabled: meta?.mediaState?.audio ?? true,
        videoEnabled: meta?.mediaState?.video ?? true,
        connectionState: peerConnection?.connectionState || "new",
      });
    });
    setRemoteParticipants(participants);
  }, []);

  const addLocalTracksToPeer = useCallback((peerConnection) => {
    const stream = localStreamRef.current;
    if (!stream || !peerConnection) return;

    stream.getTracks().forEach((track) => {
      const alreadyAdded = peerConnection
        .getSenders()
        .some((sender) => sender.track?.id === track.id);

      if (!alreadyAdded) {
        peerConnection.addTrack(track, stream);
      }
    });
  }, []);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Your browser does not support camera and microphone access.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(stream.getAudioTracks().length > 0);
      setVideoEnabled(stream.getVideoTracks().length > 0);

      peerConnectionsRef.current.forEach((peerConnection) => {
        addLocalTracksToPeer(peerConnection);
      });

      return stream;
    } catch (err) {
      console.error("[webrtc] failed to access local media", err);
      setError(
        "Microphone or camera access was blocked. You can still join the call.",
      );
      return null;
    }
  }, [addLocalTracksToPeer]);

  const createPeerConnection = useCallback(
    (targetSocketId, peerInfo) => {
      if (!targetSocketId) return null;

      if (peerConnectionsRef.current.has(targetSocketId)) {
        return peerConnectionsRef.current.get(targetSocketId);
      }

      if (!window.RTCPeerConnection) {
        setError("WebRTC is not supported in this browser.");
        return null;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: iceServersRef.current,
      });
      peerConnectionsRef.current.set(targetSocketId, peerConnection);
      peerMetaRef.current.set(targetSocketId, peerInfo || {});

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
            roomId,
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          remoteStreamsRef.current.set(targetSocketId, stream);
          syncParticipants();
        }
      };

      peerConnection.onconnectionstatechange = () => {
        syncParticipants();
        setConnectionState(peerConnection.connectionState);
      };

      peerConnection.oniceconnectionstatechange = () => {
        syncParticipants();
        setConnectionState(peerConnection.iceConnectionState);
      };

      addLocalTracksToPeer(peerConnection);
      syncParticipants();
      return peerConnection;
    },
    [addLocalTracksToPeer, roomId, socket, syncParticipants],
  );

  const initiateOffer = useCallback(
    async (targetSocketId, peerInfo) => {
      if (!socket || !roomId || pendingOffersRef.current.has(targetSocketId))
        return;

      const peerConnection = createPeerConnection(targetSocketId, peerInfo);
      if (!peerConnection) return;

      pendingOffersRef.current.add(targetSocketId);

      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit(SOCKET_EVENTS.WEBRTC_OFFER, {
          roomId,
          targetSocketId,
          sdp: peerConnection.localDescription,
        });
      } catch (err) {
        console.error("[webrtc] failed to create offer", err);
        setError("Failed to start a call with the selected participant.");
      } finally {
        pendingOffersRef.current.delete(targetSocketId);
      }
    },
    [createPeerConnection, roomId, socket],
  );

  const joinCall = useCallback(async () => {
    if (!socket || !roomId || joinedRef.current) return;

    joinedRef.current = true;
    setIsJoined(true);
    setIsConnecting(true);
    setError("");

    await ensureLocalStream();
    socket.emit(SOCKET_EVENTS.WEBRTC_JOIN, { roomId });
  }, [ensureLocalStream, roomId, socket]);

  const leaveCall = useCallback(() => {
    if (!socket || !roomId) return;

    socket.emit(SOCKET_EVENTS.WEBRTC_LEAVE, { roomId });

    peerConnectionsRef.current.forEach((peerConnection) => {
      peerConnection.close();
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    peerMetaRef.current.clear();
    pendingOffersRef.current.clear();

    joinedRef.current = false;
    setIsJoined(false);
    setIsConnecting(false);
    setRemoteParticipants([]);
    setConnectionState("idle");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, [roomId, socket]);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const nextValue = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = nextValue;
    });
    setAudioEnabled(nextValue);
    socket?.emit(SOCKET_EVENTS.WEBRTC_MEDIA_STATE, {
      roomId,
      audio: nextValue,
      video: videoEnabled,
    });
  }, [audioEnabled, roomId, socket, videoEnabled]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const nextValue = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = nextValue;
    });
    setVideoEnabled(nextValue);
    socket?.emit(SOCKET_EVENTS.WEBRTC_MEDIA_STATE, {
      roomId,
      audio: audioEnabled,
      video: nextValue,
    });
  }, [audioEnabled, roomId, socket, videoEnabled]);

  useEffect(() => {
    const fetchIceConfig = async () => {
      try {
        const response = await api.get("/call/ice-config");
        iceServersRef.current = response.data?.iceServers || [];
      } catch (err) {
        console.error("[webrtc] failed to load ICE config", err);
      }
    };

    fetchIceConfig();
  }, []);

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const onExistingPeers = ({ peers = [] }) => {
      peers.forEach((peer) => {
        if (!peer?.socketId || peer.socketId === socket.id) return;
        const peerConnection = createPeerConnection(peer.socketId, peer);
        if (peerConnection) {
          initiateOffer(peer.socketId, peer);
        }
      });
    };

    const onPeerJoined = ({ peer }) => {
      if (!peer?.socketId || peer.socketId === socket.id) return;
      createPeerConnection(peer.socketId, peer);
      // Joiner sends the offer to us via webrtc:offer — we just prepare here
    };

    const onOffer = async ({ sdp, fromSocketId, from }) => {
      if (!sdp || !fromSocketId || fromSocketId === socket.id) return;

      const peerConnection = createPeerConnection(fromSocketId, from);
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(sdp),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
          roomId,
          targetSocketId: fromSocketId,
          sdp: peerConnection.localDescription,
        });
      } catch (err) {
        console.error("[webrtc] failed to answer call", err);
        setError("The call could not be established with that participant.");
      }
    };

    const onAnswer = async ({ sdp, fromSocketId }) => {
      if (!sdp || !fromSocketId || fromSocketId === socket.id) return;

      const peerConnection = peerConnectionsRef.current.get(fromSocketId);
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(sdp),
        );
      } catch (err) {
        console.error("[webrtc] failed to apply answer", err);
      }
    };

    const onIceCandidate = async ({ candidate, fromSocketId }) => {
      if (!candidate || !fromSocketId || fromSocketId === socket.id) return;

      const peerConnection = peerConnectionsRef.current.get(fromSocketId);
      if (!peerConnection) return;

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[webrtc] failed to add ICE candidate", err);
      }
    };

    const onPeerLeft = ({ socketId }) => {
      if (!socketId) return;
      const peerConnection = peerConnectionsRef.current.get(socketId);
      peerConnection?.close();
      peerConnectionsRef.current.delete(socketId);
      remoteStreamsRef.current.delete(socketId);
      peerMetaRef.current.delete(socketId);
      syncParticipants();
    };

    const onMediaState = ({ socketId, audio, video }) => {
      if (!socketId) return;
      const meta = peerMetaRef.current.get(socketId);
      if (meta) {
        meta.mediaState = { audio: !!audio, video: !!video };
        peerMetaRef.current.set(socketId, meta);
        syncParticipants();
      }
    };

    const onError = ({ message }) => {
      setError(message || "The call could not be completed.");
    };

    socket.on(SOCKET_EVENTS.WEBRTC_EXISTING_PEERS, onExistingPeers);
    socket.on(SOCKET_EVENTS.WEBRTC_PEER_JOINED, onPeerJoined);
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);
    socket.on(SOCKET_EVENTS.WEBRTC_PEER_LEFT, onPeerLeft);
    socket.on(SOCKET_EVENTS.WEBRTC_MEDIA_STATE, onMediaState);
    socket.on(SOCKET_EVENTS.WEBRTC_ERROR, onError);

    return () => {
      socket.off(SOCKET_EVENTS.WEBRTC_EXISTING_PEERS, onExistingPeers);
      socket.off(SOCKET_EVENTS.WEBRTC_PEER_JOINED, onPeerJoined);
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
      socket.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);
      socket.off(SOCKET_EVENTS.WEBRTC_PEER_LEFT, onPeerLeft);
      socket.off(SOCKET_EVENTS.WEBRTC_MEDIA_STATE, onMediaState);
      socket.off(SOCKET_EVENTS.WEBRTC_ERROR, onError);
    };
  }, [createPeerConnection, roomId, socket, initiateOffer, syncParticipants]);

  useEffect(() => {
    if (!roomId) return undefined;

    return () => {
      leaveCall();
    };
  }, [leaveCall, roomId]);

  return {
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
  };
};

export default useWebRTC;
