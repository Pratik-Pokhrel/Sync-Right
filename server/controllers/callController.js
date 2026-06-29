import { ENV } from "../config/env.js";

/*
  GET /call/ice-config  (protected)

  1. Returns th ICE server list the client passes into : " new RTCPeerConnection({ iceServers }) "
  2. Always includes the Google STUN as baseline
  3. Also includes TURN if configured ( it is configured in this project : URL in this file and other 2 vars in .env file)

*/

export const getIceConfig = async (req, res) => {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
  ];

  // Only add TURN servers if credentials are actually configured
  // Without this guard, RTCPeerConnection constructor throws InvalidAccessError
  if (ENV.TURN_USERNAME && ENV.TURN_CREDENTIAL) {
    iceServers.push(
      {
        urls: "turn:global.relay.metered.ca:80",
        username: ENV.TURN_USERNAME,
        credential: ENV.TURN_CREDENTIAL,
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: ENV.TURN_USERNAME,
        credential: ENV.TURN_CREDENTIAL,
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: ENV.TURN_USERNAME,
        credential: ENV.TURN_CREDENTIAL,
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: ENV.TURN_USERNAME,
        credential: ENV.TURN_CREDENTIAL,
      },
    );
  }

  return res.status(200).json({ success: true, iceServers });
};
