import multer from "multer";
import path from "path";
import fs from "fs";

// Create uploads directory if it doesn't exist
const uploadsDir = "./uploads";
const postsDir = path.join(uploadsDir, "posts");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "post-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Accept images, videos, and audio files
  if (
    file.mimetype.startsWith("image") ||
    file.mimetype.startsWith("video") ||
    file.mimetype.startsWith("audio")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type!"), false);
  }
};

// Configure multer with the storage, limits, and fileFilter
export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

export default upload;
