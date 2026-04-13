const router = require("express").Router();
const { AuthController } = require("../controllers/auth.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");

router.post("/login", AuthController.login);
router.post("/logout", authenticateToken, AuthController.logout);
router.get("/me", authenticateToken, AuthController.getMe);
router.put("/change-password", authenticateToken, AuthController.changePassword);
router.post("/register", AuthController.register);

module.exports = router;