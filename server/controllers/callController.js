import { ENV } from "../config/env.js";

/*
  GET /call/ice-config  (protected)

  1. Returns th ICE server list the client passes into : " new RTCPeerConnection({ iceServers }) "
  2. Always includes the Google STUN as baseline
  3. Also includes TURN if configured ( it is configured in this project : URL in this file and other 2 vars in .env file)

*/

export const getIceConfig = async (req, res) => {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" }, // these STUN servers are publicly available so no problem in hardcoding them in this file
    { urls: "stun:stun1.l.google.com:19302" }, // fallback STUN - google
    { urls: "stun:stun.relay.metered.ca:80" }, // fallback STUN - metered.ca custom server
    {
      urls: "turn:global.relay.metered.ca:80", // TURN over UDP
      username: ENV.TURN_USERNAME,
      credential: ENV.TURN_CREDENTIAL,
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp", // TURN over TCP - UDP blocked fallback
      username: ENV.TURN_USERNAME,
      credential: ENV.TURN_CREDENTIAL,
    },
    {
      urls: "turn:global.relay.metered.ca:443", // TURN over TLS - corporate firewalls
      username: ENV.TURN_USERNAME,
      credential: ENV.TURN_CREDENTIAL,
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp", // TLS + TCP - strictest firewall fallback
      username: ENV.TURN_USERNAME,
      credential: ENV.TURN_CREDENTIAL,
    },
  ];

  return res.status(200).json({ success: true, iceServers });
};
