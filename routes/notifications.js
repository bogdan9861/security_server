const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth");

const {
  getMyNotifications,
  markAsRead,
  getUnreadCount
} = require("../controllers/notifications");

router.get("/", auth, getMyNotifications);
router.post("/read/:id", auth, markAsRead);
router.get("/unreaded", auth, getUnreadCount);

module.exports = router;
