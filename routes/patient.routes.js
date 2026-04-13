const router = require("express").Router();
const { PatientController } = require("../controllers/patient.controller");
const {
  authenticateToken,
  requireRoles,
} = require("../middlewares/auth.middleware");

router.use(authenticateToken);

router.get("/", PatientController.getAll);
router.get("/search", PatientController.search);
router.get("/:id", PatientController.getOne);
router.post(
  "/",
  requireRoles("ADMIN", "REGISTRATOR"),
  PatientController.create
);
router.put(
  "/:id",
  requireRoles("ADMIN", "REGISTRATOR", "DOCTOR"),
  PatientController.update
);
router.delete("/:id", requireRoles("ADMIN"), PatientController.delete);

module.exports = router;
