const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth");
const { getTicketComments, addComment } = require("../controllers/comments");

router.post("/", auth, addComment);
router.get("/:ticketId", auth, getTicketComments);

module.exports = router;
