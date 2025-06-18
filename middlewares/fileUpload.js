import multer from "multer";
import path from "path";

const postStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "post-" + uniqueSuffix + path.extname(file.originalname));
  },
});

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

// Avatar storage and filter
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const avatarFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed for avatars!"), false);
  }
};

export const uploadPostMedia = multer({
  storage: postStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: mediaFileFilter,
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for avatars
  fileFilter: avatarFileFilter,
});
