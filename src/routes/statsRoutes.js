const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
const verifyToken = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");


router.get("/", verifyToken,authorizeRoles("admin"),statsController.getAdminStats);

module.exports = router;