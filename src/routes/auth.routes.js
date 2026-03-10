const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/login", controller.login);
router.post("/mfa", controller.verifyMFA);
router.get("/me", verifyToken, controller.getMe);
router.get("/dashboard", verifyToken, controller.dashboard);

module.exports = router;
