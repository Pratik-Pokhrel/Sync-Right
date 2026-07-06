// this is the file that intercepts the incoming multipart/form-data request and givess the raw file buffer (which is kept in RAM, never written to disk)

import multer from "multer";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB capacity

// Only allow the actual image formats, discard everything else at this multer layer  before it reaches the controller or cloudinary

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true); // accept the file
  } else {
    cb(
      new Error("Only valid image formats are allowed (jpeg, png, jpg, webp)"),
      false,
    ); // reject the file
  }
};

// memoryStorage() : file lives in req.file.buffer (RAM only), nothing touches the disk
// this buffer is what is streamed straight to cloudinary in the controller for upload

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
