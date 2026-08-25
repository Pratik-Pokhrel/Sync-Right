// This file runs entirely in the browser (Web Crypto API), no library needed

// 1. Generate ECDH key pair on room join
export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // exportable -> we need to send the public half to peers
    ["deriveKey"],
  );
}

// 2. Export public key to JWK for transmission over the socket
export async function exportPublicKey(keyPair) {
  return crypto.subtle.exportKey("jwk", keyPair.publicKey);
}

// 3. Import a peer's JWK public key
export async function importPeerPublicKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

// 4. Derive a shared AES-GCM key via ECDH + HKDF
export async function deriveSharedKey(myPrivateKey, peerPublicKey) {
  const rawShared = await crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    myPrivateKey,
    { name: "HKDF" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: new TextEncoder().encode("syncright-room-key"),
    },
    rawShared,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// 5. Encrypt a plaintext string before sending
export async function encryptMessage(plaintext, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV, never reused
  const enc = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    enc,
  );

  // Prepend IV to ciphertext -> receiver needs it to decrypt
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined)); // base64 for socket transport
}

// 6. Decrypt a received base64 payload
export async function decryptMessage(base64Payload, aesKey) {
  const bytes = Uint8Array.from(atob(base64Payload), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext,
  );
  return new TextDecoder().decode(plainBuf);
}
