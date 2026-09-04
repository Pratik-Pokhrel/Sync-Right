import Redis from "ioredis";
import { ENV } from "./env.js";

const redis = new Redis(ENV.REDIS_URL, {
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: 3,
});

// Previous individual Redis configuration, retained for reference only:
// const redisConfig = {
//   host: ENV.REDIS_HOST,
//   port: Number(ENV.REDIS_PORT) || 6379,
//   username: ENV.REDIS_USERNAME || "default",
//   password: ENV.REDIS_PASSWORD,
//   tls: ENV.REDIS_TLS ? {} : undefined,
//   retryStrategy: (times) => Math.min(times * 100, 3000),
//   maxRetriesPerRequest: 3,
// };
// const redis = new Redis(redisConfig);

redis.on("connect", () => console.log("[redis] connected successfully"));
redis.on("error", (err) => console.log("[redis] error:", err.message));

export { redis };
export default redis;
