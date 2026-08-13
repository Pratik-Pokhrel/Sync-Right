import { redis } from "../config/redis.js";

const BOARD_TTL = 4 * 60 * 60; // 4 hours

// this is to replace the old persist() in whiteboardEvent.js which used to call "Room.findByIdAndUpdate' on every single stroke which was a bottleneck for real-case scenario because the writes would at drawing speed
// so now the redis handles the board state and the DB bottleneck is hence relieved
export const saveBoardSnapshot = async (roomId, snapshot) => {
  await redis.set(
    `room:${roomId}:board`,
    JSON.stringify(snapshot),
    "EX",
    BOARD_TTL,
  );
};

// this below function is used to sync the later joiner's canvas (board state) without touching the MongoDB
export const getBoardSnapshot = async (roomId) => {
  const raw = await redis.get(`room:${roomId}:board`);
  return raw ? JSON.parse(raw) : []; // return empty array if no snapshot found
};
