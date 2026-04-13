const router = require("express").Router();

const authRoutes = require("./auth.routes");
const patientRoutes = require("./patient.routes");
const doctorRoutes = require("./doctor.routes");
const appointmentRoutes = require("./appointment.routes");
const visitRoutes = require("./visit.routes");
const diagnosisRoutes = require("./diagnosis.routes");

// Регистрация всех маршрутов
router.use("/auth", authRoutes);
router.use("/patients", patientRoutes);
router.use("/doctors", doctorRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/visits", visitRoutes);
router.use("/diagnoses", diagnosisRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

module.exports = router;
