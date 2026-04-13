const router = require("express").Router();
const {
  AppointmentController,
} = require("../controllers/appointment.controller");
const {
  authenticateToken,
  requireRoles,
} = require("../middlewares/auth.middleware");

router.use(authenticateToken);

router.get("/", AppointmentController.getAll);
router.get("/my", AppointmentController.getMine);
router.get("/available-slots", AppointmentController.getAvailableSlots);
router.post(
  "/",
  requireRoles("ADMIN", "REGISTRATOR", "DOCTOR"),
  AppointmentController.create
);
router.put("/:id/cancel", AppointmentController.cancel);

module.exports = router;
