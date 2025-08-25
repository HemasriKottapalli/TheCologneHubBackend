// middleware/upload.js
const multer = require("multer");

const storage = multer.memoryStorage(); // store in memory (no disk save)
const upload = multer({ storage });

module.exports = upload;