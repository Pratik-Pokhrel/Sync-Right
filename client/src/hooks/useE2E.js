import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../utils/socket";
import { SOCKET_EVENTS } from "../utils/socketEvents";
import { tokenStorage } from "../utils/tokenStorage";
import {
  generateKeyPair,
  exportPublicKey,
  importPeerPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from "../utils/e2e";

// Manages the ECDH key pair for this session and a Map of derived AES
// keys, one per peer in the room. Pass null/undefined for roomId to keep
// this idle before a session actually starts.
const useE2E = (roomId) => {
  const [ready, setReady] = useState(false); // true once our own key pair exists
  const [keysVersion, setKeysVersion] = useState(0);
  const socket = getSocket();
  const currentUserId = tokenStorage.getUser()?.id;

  const keyPairRef = useRef(null);
  const peerKeysRef = useRef(new Map()); // userId -> derived AES CryptoKey

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    let cancelled = false;

    const init = async () => {
      const keyPair = await generateKeyPair();
      if (cancelled) return;
      keyPairRef.current = keyPair;

      // Derive a private self-key so the sender can decrypt their own messages.
      const selfKey = await deriveSharedKey(
        keyPair.privateKey,
        keyPair.publicKey,
      );
      peerKeysRef.current.set(currentUserId, selfKey);

      const publicKeyJwk = await exportPublicKey(keyPair);
      socket.emit(SOCKET_EVENTS.E2E_PUBLIC_KEY, { roomId, publicKeyJwk });

      // Ask existing participants to resend their keys -> covers the case
      // where we joined after everyone else already exchanged keys once.
      socket.emit(SOCKET_EVENTS.E2E_REQUEST_KEYS, { roomId });

      setReady(true);
    };

    init();

    const onPeerKey = async ({ userId, publicKeyJwk }) => {
      if (!keyPairRef.current || !userId || userId === currentUserId) return;
      try {
        const peerPublicKey = await importPeerPublicKey(publicKeyJwk);
        const sharedKey = await deriveSharedKey(
          keyPairRef.current.privateKey,
          peerPublicKey,
        );
        peerKeysRef.current.set(userId, sharedKey);
        setKeysVersion((version) => version + 1);
      } catch (err) {
        console.error("[e2e] failed to derive shared key:", err.message);
      }
    };

    // A newcomer asked for keys -> resend ours so they can derive with us
    const onKeyRequest = async () => {
      if (!keyPairRef.current) return;
      const publicKeyJwk = await exportPublicKey(keyPairRef.current);
      socket.emit(SOCKET_EVENTS.E2E_PUBLIC_KEY, { roomId, publicKeyJwk });
    };

    socket.on(SOCKET_EVENTS.E2E_PEER_KEY, onPeerKey);
    socket.on(SOCKET_EVENTS.E2E_KEY_REQUEST, onKeyRequest);
    const peerKeys = peerKeysRef.current;

    return () => {
      cancelled = true;
      socket.off(SOCKET_EVENTS.E2E_PEER_KEY, onPeerKey);
      socket.off(SOCKET_EVENTS.E2E_KEY_REQUEST, onKeyRequest);
      keyPairRef.current = null;
      peerKeys.clear();
      setKeysVersion(0);
      setReady(false);
    };
  }, [socket, roomId, currentUserId]);

  // Encrypts plaintext once per known peer, including the sender's self-key.
  const encryptForRoom = useCallback(async (plaintext) => {
    if (peerKeysRef.current.size === 0) return null;

    const payloads = {};
    for (const [userId, aesKey] of peerKeysRef.current.entries()) {
      payloads[userId] = await encryptMessage(plaintext, aesKey);
    }
    return JSON.stringify(payloads);
  }, []);

  // Decrypts an incoming message. payloadJson is the JSON string of
  // { [recipientUserId]: base64 }. senderUserId identifies whose pairwise
  // key to use. Returns "[encrypted]" on any failure instead of throwing,
  // so a UI render never crashes on a tampered/undecryptable payload.
  const decryptFromSender = useCallback(
    async (payloadJson, senderUserId) => {
      try {
        const payloads = JSON.parse(payloadJson);
        const myCiphertext = payloads[currentUserId];
        const aesKey = peerKeysRef.current.get(senderUserId);
        if (!myCiphertext || !aesKey) return "[encrypted]";
        return await decryptMessage(myCiphertext, aesKey);
      } catch {
        return "[encrypted]";
      }
    },
    [currentUserId],
  );

  return { ready, keysVersion, encryptForRoom, decryptFromSender };
};

export default useE2E;
