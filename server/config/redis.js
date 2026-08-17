import Redis from "ioredis";
import { ENV } from "./env.js";

const redisConfig = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  username: ENV.REDIS_USERNAME,
  password: ENV.REDIS_PASSWORD,
  tls: ENV.REDIS_TLS ? {} : undefined,
  retryStrategy: (times) => Math.min(times * 100, 3000), // exponential backoff for reconnection attempts
  maxRetriesPerRequest: 3,
};

// Single shared client which is used for everything like refresh tokens, rate limit counters, whiteboard snapshots
export const redis = new Redis(redisConfig);

redis.on("connect", () => console.log("[redis] connected"));
redis.on("error", (err) => console.log("[redis] error", err.message));

export default redis;
