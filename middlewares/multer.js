import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = "./uploads";
const postsDir = path.join(uploadsDir, "posts");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = "post-" + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);

    const destPath = path.join("./public/uploads/posts", filename);
    const srcPath = path.join(postsDir, filename);
    setTimeout(() => {
      if (fs.existsSync(srcPath)) {
        fs.copyFile(srcPath, destPath, (err) => {
          if (err) console.error("Failed to copy post media to public:", err);
        });
      }
    }, 100);
  },
});

const fileFilter = (req, file, cb) => {
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

export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter,
});

export default upload;
