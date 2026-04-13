const router = require("express").Router();
const { VisitController } = require("../controllers/visit.controller");
const {
  authenticateToken,
  requireRoles,
} = require("../middlewares/auth.middleware");

router.use(authenticateToken);

router.get("/", VisitController.getAll);
router.get("/statistics", VisitController.getStatistics);
router.get("/:id", VisitController.getOne);
router.get("/patient/:id", VisitController.getPatientVisits);
router.post(
  "/",
  requireRoles("ADMIN", "DOCTOR", "REGISTRATOR"),
  VisitController.create
);
router.post(
  "/:id/prescriptions",
  requireRoles("ADMIN", "DOCTOR"),
  VisitController.addPrescription
);
router.put("/:id", requireRoles("ADMIN", "DOCTOR"), VisitController.update);
router.delete("/:id", requireRoles("ADMIN"), VisitController.delete);

module.exports = router;
