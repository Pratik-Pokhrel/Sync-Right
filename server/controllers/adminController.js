import User from "../models/User.js";
import Room from "../models/Room.js";

// GET /admin/users -> a paginated list of all the users available in the system
export const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1); // Ensure the page number is at least 1, default to 1 if not provided or invalid
    const limit = Math.min(20, parseInt(req.query.limit) || 20); // Limit the number of users per page to a maximum of 20, default to 20 if not provided or invalid
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

// GET /admin/users/:id -> details of a specific user by their ID
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// PATCH /admin/users/:id/status -> activate or deactivate a user account
export const setUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid request: isActive must be a boolean value",
      });
    }

    // Prevent the admin from deactivating their own account
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change the status of your own account as an admin",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
