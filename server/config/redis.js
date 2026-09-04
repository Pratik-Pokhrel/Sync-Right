import Redis from "ioredis";
import { ENV } from "./env.js";

// Upstash and hosted Redis providers require TLS enabled
const redisConfig = ENV.REDIS_URL
  ? ENV.REDIS_URL
  : {
      host: ENV.REDIS_HOST,
      port: Number(ENV.REDIS_PORT) || 6379,
      username: ENV.REDIS_USERNAME || "default",
      password: ENV.REDIS_PASSWORD,
      // String booleans from process.env must be checked explicitly
      tls: ENV.REDIS_TLS === "true" || ENV.REDIS_TLS === true ? {} : undefined,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: 3,
    };

export const redis = new Redis(redisConfig);

redis.on("connect", () => console.log("[redis] connected successfully"));
redis.on("error", (err) => console.log("[redis] error:", err.message));

export default redis;
