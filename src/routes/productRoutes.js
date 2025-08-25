// routes/productRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
const verifyToken = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
const productController = require("../controllers/productController");

// ✅ Bulk Upload
router.post(
  "/upload",
  verifyToken,
  authorizeRoles("admin"),
  upload.single("file"),
  productController.uploadProducts
);

// ✅ Download
router.get(
  "/download",
  verifyToken,
  authorizeRoles("admin"),
  productController.downloadProducts
);

module.exports = router;