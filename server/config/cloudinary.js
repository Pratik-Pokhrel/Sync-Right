import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./env.js";

// here the Cloudinary SDK is configured at startup using creddentials from .env file
// Every other file imports this same confiured instance

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;
