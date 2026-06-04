const fs = require("fs");
const multer = require("multer");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueName + extension);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

module.exports = upload;