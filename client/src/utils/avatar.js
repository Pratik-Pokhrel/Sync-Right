// Generates a deterministic default avatar URL when the user has no
// uploaded profile picture.
const DICEBEAR_BASE = "https://api.dicebear.com/9.x/glass/svg";

const getSeedFromUser = (user) => {
  if (!user || typeof user !== "object") return "guest";

  return (
    user._id ||
    user.id ||
    user.userId ||
    user.email ||
    user.username ||
    user.name ||
    "guest"
  );
};

export const getAvatarUrl = (user) => {
  if (!user) return `${DICEBEAR_BASE}?seed=guest`;

  const avatar =
    user.avatar || user.profilePicture || user.profilePic || user.photoURL;
  if (avatar) return avatar;

  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(getSeedFromUser(user))}`;
};

export const getDisplayName = (user) => {
  if (!user) return "User";

  return user.username || user.name || user.email?.split("@")[0] || "User";
};
