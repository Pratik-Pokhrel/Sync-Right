import mongoose from "mongoose";

const { Schema } = mongoose;

const SessionSchema = new Schema(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    host: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    participants: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        joinedAt: { type: Date, default: Date.now },
        leftAt: { type: Date, default: null },
      },
    ],

    startTime: {
      type: Date,
      default: Date.now,
    },

    endTime: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number, // Duration in seconds
      default: null,
    },

    summary: {
      type: String,
      default: null,
    },

    actionItems: {
      type: [String],
      default: [],
    },

    summaryGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// compound Index -> 1 : all sessions of a room, -1 : most recent first
SessionSchema.index({ room: 1, createdAt: -1 });

// Instance method to end the session and compute duration
SessionSchema.methods.endSession = function () {
  this.endTime = new Date();
  this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  return this.save();
};

export default mongoose.model("Session", SessionSchema);
