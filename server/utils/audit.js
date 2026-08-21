import AuditLog from "../models/AuditLog.js";

/*
    Centralized audit writer -> called from controllers wherever and whenever a sensitive action takes place like login. role change, room delete .......

    Fire and Forget (on purpose) : a failed audit write must never crash the primary operation the user actually asked for

    * @param {string} action - e.g. 'user.login', 'room.deleted'
    * @param {object} options
    * @param {ObjectId} [options.actor] - who performed the action (req.user._id)
    * @param {ObjectId} [options.target] - affected document ID
    * @param {string} [options.targetModel] - 'User' | 'Room' | 'Message'
    * @param {object} [options.meta] - extra context
    * @param {Request} [options.req] - Express request (for ip + userAgent)
*/

export const audit = (action, options = {}) => {
  const {
    actor = null,
    target = null,
    targetModel = null,
    meta = {},
    req,
  } = options;
  const ip = req?.ip || null;
  const userAgent = req?.headers?.["user-agent"] || null;

  AuditLog.create({
    action,
    actor,
    target,
    targetModel,
    meta,
    ip,
    userAgent,
  }).catch((err) => console.error("[audit] write failed: ", err.message));
};
