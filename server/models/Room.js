import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema } = mongoose; // Destructuring the 'mongoose' object to get the 'Schema' class

const RoomSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Room name must be at least 3 characters"],
      maxlength: [50, "Room name cannot exceed 50 characters"],
    },

    // Only one host per room
    host: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    password: {
      type: String,
      default: null,
      select: false, // never expose hashed room password
    },

    isPrivate: {
      type: Boolean,
      default: false,
    },

    // but participants can be many, and they can join/leave at any time, so we need an array of user references unlike the host
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    boardSnapshot: {
      type: Array,
      default: [], // stores last N draw events for late joiners
    },

    maxParticipants: {
      type: Number,
      default: 10,
      min: [2, "Room must allow at least 2 participants"],
      max: [30, "Room cannot exceed 30 participants"],
    },

    isActive: {
      type: Boolean,
      default: false, // becomes true when host starts the session
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields to the schema
  },
);

// Hash room password before save —> only if set and modified
RoomSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Instance method -? verify room password on join
RoomSchema.methods.verifyPassword = async function (candidatePassword) {
  if (!this.password) return true; // public room, no password needed
  return bcrypt.compare(candidatePassword, this.password);
};

// current participant count (no extra DB call needed)
RoomSchema.virtual("participantCount").get(function () {
  return this.participants.length;
});

// Index -> This below line tells MongoDB to create an Index on the host field. Instead of searching through every single room document one by one to find which ones belong to a specific host, MongoDB can look up the host's ID in this index and find the matching rooms instantly. The number 1 means the index is sorted in ascending order (from lowest value to highest)
RoomSchema.index({ host: 1 });

export default mongoose.model("Room", RoomSchema);
// Collection name becomes 'rooms'
