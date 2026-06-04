// (...roles) -> can be one or more than one role, in case there might be new roles introduced later on
export const roleAuthorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have permission to access this resource",
      });
    }
    next(); // next() is called only if the user is authenticated and has the required role(s) and this next() will pass control to the next middleware or route handler in the stack, allowing the request to proceed if the user is authorized.
  };
