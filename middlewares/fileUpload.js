import fs from "fs";

export const ensureDirectoriesExist = () => {
  const directories = [
    "./uploads",
    "./uploads/posts",
    "./uploads/avatars",
    "./public",
    "./public/uploads",
    "./public/uploads/avatars",
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
      }
    }
  }
};

export const createUploadMiddleware = (req, res, next) => {
  ensureDirectoriesExist();
  next();
};
