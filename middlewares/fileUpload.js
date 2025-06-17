import multer from "multer";
import path from "path";
import fs from "fs";

const avatarDir = "./public/uploads/avatars";
const postDir = "./public/uploads/posts";

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

if (!fs.existsSync(postDir)) {
  fs.mkdirSync(postDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = "avatar-" + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);

    const destPath = path.join("./public/uploads/avatars", filename);
    const srcPath = path.join(avatarDir, filename);
    setTimeout(() => {
      if (fs.existsSync(srcPath)) {
        fs.copyFile(srcPath, destPath, (err) => {
          if (err) console.error("Failed to copy avatar to public:", err);
        });
      }
    }, 100);
  },
});

const postStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "post-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed!"), false);
  }
};

const mediaFileFilter = (req, file, cb) => {
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

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

export const uploadPostMedia = multer({
  storage: postStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: mediaFileFilter,
});
