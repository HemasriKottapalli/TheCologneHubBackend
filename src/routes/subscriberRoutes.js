// routes/subscriber.routes.js
const express = require("express")
const { addSubscriber, removeSubscriber, exportSubscribers, exportSubscribersData, unsubscribeSubscriber } = require("../controllers/subscriberController");

const verifyToken = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

const router = express.Router();

router.post("/add",addSubscriber);
router.get("/unsubscribe/:id",  verifyToken,authorizeRoles("admin","user"),removeSubscriber);
router.get("/unsubscribe/page/:token" ,unsubscribeSubscriber);

router.get("/export",  verifyToken,authorizeRoles("admin"), exportSubscribers);
router.get("/",  verifyToken,authorizeRoles("admin"), exportSubscribersData);


module.exports =  router;