import mongoose from "mongoose";
import { ENV } from "./env.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGO_URI, { tls: false }); //tls: false is default but tls is required for some cloud providers like MongoDB Atlas
    console.log(`MongoDB Connected : ${conn.connection.host}`);
  } catch (err) {
    console.log(`Database Connection failed: ${err.message}`);
    process.exit(1); // Kills the server if the database connection fails, no point in running the server without a database connection
  }
};

export default connectDB;
