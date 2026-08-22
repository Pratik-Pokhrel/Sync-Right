import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema } = mongoose; // Destructuring the 'mongoose' object to get the 'Schema' class

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      index: true, // Create an index on the username field for faster queries
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"], // Simple regex for email validation
      index: true, // Create an index on the email field
    },

    password: {
      type: String,
      required: function () {
        return this.authProvider === "local"; // Only require a password if the user is registering with local authentication, not with Google OAuth
      },
      minlength: [8, "Password must be at least 8 characters long"],
      maxlength: [128, "Password cannot exceed 128 characters"],
      select: false, // Exclude the password field from query results by default for security reasons
    },

    refreshToken: {
      type: String,
      default: null,
      select: false, // Exclude the refreshToken field for same reason as password
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    googleId: {
      type: String,
      default: null,
      index: false,
    },

    avatar: {
      type: String,
      default: null,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    twoFactorSecret: {
      type: String,
      default: null,
      select: false, // never expose secret in queries by default -> same as that of password
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields to the schema
  },
);

// Hash password before saving the user document to the database
//.pre() is a Mongoose middleware function that runs before the 'save' operation is executed on a document.
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return; // Only hash the password if it has been modified (or is new)
  this.password = await bcrypt.hash(this.password, 12); // Hash the password with a salt round of 12
});

//Instance method to compare the provided password with the hashed password stored in the database
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password); // Returns true if the passwords match, false otherwise
};

//Instance method to strip the sensitive fields before sending the response to the client
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject(); // Convert the Mongoose document to a plain JavaScript object
  delete obj.password; // Remove the password field
  delete obj.refreshToken; // Remove the refreshToken field
  return obj; // Return the sanitized object
};

export default mongoose.model("User", UserSchema); // Export the User model based on the UserSchema
// Collection name will be 'users' -> (Mongoose automatically pluralizes the model name to determine the collection name)
