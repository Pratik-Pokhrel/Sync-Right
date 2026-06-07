import { z } from "zod";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .transform((v) => v.trim()),
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters"),
});

const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

// Room Validation
// Room creation: name required, password optional (makes room private), maxParticipants optional
const createRoomSchema = z.object({
  name: z
    .string()
    .min(3, "Room name must be at least 3 characters")
    .max(50, "Room name cannot exceed 50 characters")
    .transform((v) => v.trim()),
  password: z
    .string()
    .min(4, "Room password must be at least 4 characters")
    .max(64, "Room password cannot exceed 64 characters")
    .optional(), // if omitted → public room
  maxParticipants: z
    .number()
    .int()
    .min(2, "Room must allow at least 2 participants")
    .max(30, "Room cannot exceed 30 participants")
    .optional()
    .default(10),
});

// Join room: password optional (only required if room isPrivate)
const joinRoomSchema = z.object({
  password: z.string().optional(),
});

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path[0],
      message: e.message,
    }));
    return res
      .status(400)
      .json({ success: false, message: "Validation failed", errors });
  }
  req.body = result.data;
  next();
};

export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateCreateRoom = validate(createRoomSchema);
export const validateJoinRoom = validate(joinRoomSchema);
