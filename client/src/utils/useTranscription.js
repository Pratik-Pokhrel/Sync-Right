// *** NEW FILE: Phase 3 — live captions via the browser's built-in Web Speech API, zero cost

import { useState, useRef, useCallback, useEffect } from "react";
import { getSocket } from "../utils/socket";
import { SOCKET_EVENTS } from "../utils/socketEvents";

/**
  Live captions using the browser's native Web Speech API. No server call,
 no npm package, works out of the box in Chrome/Edge (Firefox/Safari
 support is limited, mention that in your report).

 captions -> { [userId]: { username, text, isFinal } } — one running line
 per speaker, same shape idea as the typingUsers map in useChat.js.
 */
const useTranscription = (roomId) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [myText, setMyText] = useState("");
  const [captions, setCaptions] = useState({}); // remote speakers' live captions

  const recognitionRef = useRef(null);
  const socket = getSocket();

  // Receive other participants' captions
  useEffect(() => {
    if (!socket || !roomId) return;

    const onTranscript = ({ user, text, isFinal }) => {
      if (!user?._id) return;
      setCaptions((prev) => ({
        ...prev,
        [user._id]: { username: user.username, text, isFinal },
      }));

      // Clear a finished line after a few seconds so captions don't pile up
      if (isFinal) {
        setTimeout(() => {
          setCaptions((prev) => {
            if (prev[user._id]?.text !== text) return prev; // a newer line already replaced it
            const next = { ...prev };
            delete next[user._id];
            return next;
          });
        }, 4000);
      }
    };

    socket.on(SOCKET_EVENTS.CHAT_TRANSCRIPT, onTranscript);
    return () => socket.off(SOCKET_EVENTS.CHAT_TRANSCRIPT, onTranscript);
  }, [socket, roomId]);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }

      const text = final || interim;
      setMyText(text);

      if (socket && roomId && text.trim()) {
        socket.emit(SOCKET_EVENTS.CHAT_TRANSCRIPT, {
          roomId,
          transcript: text,
          text,
          isFinal: !!final,
        });
      }
    };

    recognition.onerror = (event) => {
      console.error("[transcription] error:", event.error);
    };

    recognition.onend = () => {
      // auto-restart if the user hasn't explicitly stopped it, browsers
      // cut recognition off after a period of silence
      if (recognitionRef.current) recognition.start();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [socket, roomId]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition.stop();
    }
    setIsListening(false);
    setMyText("");
  }, []);

  useEffect(() => {
    return () => stopListening();
  }, []);

  return {
    isListening,
    supported,
    myText, //  live transcript, useful for a local caption bar
    captions, // { [userId]: { username, text, isFinal } } for everyone else
    startListening,
    stopListening,
  };
};

export default useTranscription;
