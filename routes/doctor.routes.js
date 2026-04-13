const router = require("express").Router();
const { DoctorController } = require("../controllers/doctor.controller");
const {
  authenticateToken,
  requireRoles,
} = require("../middlewares/auth.middleware");

router.use(authenticateToken);

router.get("/", DoctorController.getAll);
router.get("/:id", DoctorController.getOne);
router.get("/:id/schedule", DoctorController.getSchedule);
router.get("/:id/statistics", DoctorController.getStatistics);
router.post("/", requireRoles("ADMIN"), DoctorController.create);
router.put("/:id", requireRoles("ADMIN"), DoctorController.update);
router.delete("/:id", requireRoles("ADMIN"), DoctorController.delete);

module.exports = router;
