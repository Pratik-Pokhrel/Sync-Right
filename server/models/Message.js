import mongoose from "mongoose";

const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Message text is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    type: {
      type: String,
      enum: ["text", "system"], // 'system' for join/leave announcements
      default: "text",
    },

    // E2E encryption flag
    // false (default) -> text holds plaintext (sys messages always stay this way as they aren't encrypted)
    // true -> text holds JSON.stringify({ [recipientUserId]: base64(IV+ciphertext) }), one ciphertext per room participant the sender had shared a derived key for
    encrypted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Compound index -> fast paginated fetch of messages for a room
// { room: 1, createdAt: -1 } = 1 : all messages in a room, -1 : newest first
MessageSchema.index({ room: 1, createdAt: -1 });

export default mongoose.model("Message", MessageSchema);
// Collection name in MongoDB: 'messages'
