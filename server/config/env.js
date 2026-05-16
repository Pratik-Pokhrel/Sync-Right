// Loads the environment variables from the .env file and exports them as a config object

import dotenv from "dotenv";
dotenv.config();

// The above dotenv.config() method parses the .env file from the root directory and injects the vars directly into "process.env"

export const ENV = {
  MONGO_URI: process.env.MONGO_URI,
  PORT: process.env.PORT || 5000,
};

// Fail fast if any required environment variables are missing
const required = ["MONGO_URI", "PORT"];
required.forEach((key) => {
  if (!ENV[key])
    throw new Error(`Missing required environment variable: ${key}`);
});
