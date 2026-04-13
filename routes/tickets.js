const express = require("express");
const router = express.Router();

const fileMiddleware = require("../middleware/file");
const { auth } = require("../middleware/auth");
const { admin } = require("../middleware/admin");

const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  getMyTickets,
  deleteTicket,
  getAssignedTicket,
} = require("../controllers/tickets");

router.post("/", auth, fileMiddleware.array("files"), createTicket);
router.get("/", auth, admin, getTickets);
router.get("/:operatorId/assigned", auth, admin, getAssignedTicket);
router.get("/my", auth, getMyTickets);
router.put("/:id/updateStatus", auth, admin, updateTicketStatus);
router.put("/:id/assign", auth, admin, assignTicket);
router.delete("/:id", auth, deleteTicket);

module.exports = router;
