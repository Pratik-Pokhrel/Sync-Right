import mongoose from "mongoose";

const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // null : for system generated events

    action: { type: String, required: true, index: true },
    // user.login , room.deleted

    target: {
      type: Schema.Types.ObjectId,
      refPath: "targetModel",
      default: null,
    },

    targetModel: {
      type: String,
      enum: ["User", "Room", "Message"],
      default: null,
    },

    meta: { type: Schema.Types.Mixed, default: {} },
    // additional conetxt like IP, roomId, oldRole, newRol .....

    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },

  {
    timestamps: true,
  },
);

// TTL index -> auto delete logs older than 90 days
AuditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

// compound index -> for admin queries to filter by action, most recent first
AuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);
// collection name in db -> 'auditLogs'
