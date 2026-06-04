import User from "../models/User.js";
import Room from "../models/Room.js";

// GET /admin/users -> a paginated list of all the users available in the system
export const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1); // Ensure the page number is at least 1, default to 1 if not provided or invalid
    const limit = Math.min(20, parseInt(req.query.limit) || 20); //
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().skip(skip).limit(limit).sort({ CreatedAt: -1 }), // created: -1 means the most recently created users will appear first in the list.
      User.countDocuments(), // Count the total number of users in the database for pagination metadata
    ]);

    return res.status(200).json({
      success: true,
      data: { users, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
