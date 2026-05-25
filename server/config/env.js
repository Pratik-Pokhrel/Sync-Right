// Loads the environment variables from the .env file and exports them as a config object

import dotenv from "dotenv";
dotenv.config();

// The above dotenv.config() method parses the .env file from the root directory and injects the vars directly into "process.env"

export const ENV = {
  MONGO_URI: process.env.MONGO_URI,
  PORT: process.env.PORT || 8000,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",
  NODE_ENV: process.env.NODE_ENV || "development", // defaults to development

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
};

// Fail fast if any required environment variables are missing
const required = ["MONGO_URI", "PORT"];
required.forEach((key) => {
  if (!ENV[key])
    throw new Error(`Missing required environment variable: ${key}`);
});
